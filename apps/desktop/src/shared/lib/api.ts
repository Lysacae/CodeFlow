import { invoke } from "@tauri-apps/api/core";
import type { ProgressSnapshot, SavedProgram, UserPublic } from "@/shared/lib/tauri";
import { APP_VERSION } from "@/shared/lib/version";

const TOKEN_KEY = "codeflow_api_token";
const REFRESH_KEY = "codeflow_refresh_token";
const SESSION_EXPIRED =
  "Votre session a expiré. Reconnectez-vous pour synchroniser vos projets.";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getStoredRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setStoredRefresh(token: string | null) {
  try {
    if (token) localStorage.setItem(REFRESH_KEY, token);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

function accessTokenExpired(token: string): boolean {
  const parts = token.split(".");
  if (parts.length < 2) return false;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    return Date.now() / 1000 >= payload.exp - 30;
  } catch {
    return false;
  }
}

function needsReauth(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("expired") ||
    lower.includes("invalid jwt") ||
    lower.includes("invalid claims") ||
    lower.includes("session expir")
  );
}

/** Reprend le jeton cloud depuis SQLite si le navigateur l'a perdu. */
export async function ensureStoredToken(): Promise<string | null> {
  const existing = getStoredToken();
  if (existing) return existing;
  if (!isTauri()) return null;
  try {
    const token = await invoke<string | null>("get_api_token");
    if (token) {
      setStoredToken(token);
      return token;
    }
  } catch {
    /* session locale sans jeton cloud */
  }
  return null;
}

export type AuthResponse = {
  user: UserPublic;
  token: string;
  refreshToken?: string;
};

export type LatestUpdate = {
  version: string | null;
  notes: string;
  downloadUrl: string | null;
  filename?: string;
  createdAt?: string;
};

export type CloudProgress = ProgressSnapshot & {
  updatedAt: string;
  rejected?: boolean;
};

function requireTauri() {
  if (!isTauri()) {
    throw new Error("Connexion cloud disponible dans l'application CodeFlow.");
  }
}

export async function apiRegister(input: {
  username: string;
  password: string;
  avatarData?: string | null;
}): Promise<AuthResponse> {
  requireTauri();
  return invoke<AuthResponse>("cloud_register", {
    username: input.username,
    password: input.password,
    avatarData: input.avatarData ?? null,
  });
}

export async function apiLogin(input: {
  username: string;
  password: string;
}): Promise<AuthResponse> {
  requireTauri();
  return invoke<AuthResponse>("cloud_login", {
    username: input.username,
    password: input.password,
  });
}

async function ensureRefreshToken(): Promise<string | null> {
  const existing = getStoredRefresh();
  if (existing) return existing;
  if (!isTauri()) return null;
  try {
    const token = await invoke<string | null>("get_refresh_token");
    if (token) {
      setStoredRefresh(token);
      return token;
    }
  } catch {
    /* ancien jeton sans refresh */
  }
  return null;
}

export async function clearExpiredCloudSession(): Promise<void> {
  setStoredToken(null);
  setStoredRefresh(null);
  if (!isTauri()) return;
  try {
    await invoke("clear_cloud_tokens");
  } catch {
    /* session locale conservée */
  }
}

let refreshInFlight: Promise<string | null> | null = null;

export function refreshAccessToken(clearOnFailure = true): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh(clearOnFailure).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(clearOnFailure: boolean): Promise<string | null> {
  const refresh = await ensureRefreshToken();
  if (!refresh) {
    if (clearOnFailure) await clearExpiredCloudSession();
    return null;
  }
  try {
    const auth = await invoke<AuthResponse>("cloud_refresh_session", {
      refreshToken: refresh,
    });
    setStoredToken(auth.token);
    if (auth.refreshToken) setStoredRefresh(auth.refreshToken);
    const { setCloudSession } = await import("@/shared/lib/tauri");
    await setCloudSession({
      id: auth.user.id,
      username: auth.user.username,
      avatarData: auth.user.avatarData,
      token: auth.token,
      refreshToken: auth.refreshToken || refresh,
    });
    return auth.token;
  } catch {
    if (clearOnFailure) await clearExpiredCloudSession();
    return null;
  }
}

async function requireToken(): Promise<string> {
  requireTauri();
  let token = await ensureStoredToken();
  if (!token) throw new Error("Non authentifié.");
  if (accessTokenExpired(token)) {
    const refreshed = await refreshAccessToken(true);
    if (!refreshed) throw new Error(SESSION_EXPIRED);
    token = refreshed;
  }
  return token;
}

async function withAuthRetry<T>(run: (token: string) => Promise<T>): Promise<T> {
  const token = await requireToken();
  try {
    return await run(token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!needsReauth(message)) throw error;
    const refreshed = await refreshAccessToken(true);
    if (!refreshed) throw new Error(SESSION_EXPIRED);
    return run(refreshed);
  }
}

export async function apiMe(): Promise<{ user: UserPublic }> {
  const user = await withAuthRetry((token) => invoke<UserPublic>("cloud_me", { token }));
  return { user };
}

export async function apiGetProgress(): Promise<CloudProgress> {
  return withAuthRetry((token) => invoke<CloudProgress>("cloud_get_progress", { token }));
}

export async function apiPutProgress(
  progress: ProgressSnapshot & { updatedAt: string },
): Promise<CloudProgress> {
  return withAuthRetry((token) =>
    invoke<CloudProgress>("cloud_put_progress", { token, progress }),
  );
}

export type LeaderboardEntry = {
  id: string;
  username: string;
  avatarData: string | null;
  lessons: number;
  exercises: number;
  qaMastered?: number;
  qaTimeMs?: number;
  qaComplete?: boolean;
  xp?: number;
  level?: number;
  rankId?: string;
};

export type PublicProfile = {
  id: string;
  username: string;
  avatarData: string | null;
  lessons: number;
  exercises: number;
  qaMastered: number;
  qaComplete: boolean;
  xp: number;
  level: number;
  rankId: string;
  achievements: string[];
};

export type AchievementRate = { id: string; percent: number };

export async function apiLeaderboard(): Promise<LeaderboardEntry[]> {
  requireTauri();
  let token = await ensureStoredToken();
  if (!token) throw new Error("Non authentifié.");
  if (accessTokenExpired(token)) {
    const refreshed = await refreshAccessToken(false);
    if (refreshed) token = refreshed;
  }
  return invoke<LeaderboardEntry[]>("cloud_leaderboard", { token });
}

export async function apiSyncProjects(projects: SavedProgram[]): Promise<SavedProgram[]> {
  return withAuthRetry((token) =>
    invoke<SavedProgram[]>("cloud_sync_projects", { token, projects }),
  );
}

export async function apiLatestUpdate(): Promise<LatestUpdate> {
  requireTauri();
  return invoke<LatestUpdate>("cloud_latest_update", {
    currentVersion: APP_VERSION,
  });
}

export async function apiUpdateProfile(input: {
  username: string;
  avatarData?: string | null;
}): Promise<UserPublic> {
  return withAuthRetry((token) =>
    invoke<UserPublic>("cloud_update_profile", {
      token,
      username: input.username,
      avatarData: input.avatarData ?? null,
    }),
  );
}

export async function apiUpdatePassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await withAuthRetry((token) =>
    invoke("cloud_update_password", { token, currentPassword, newPassword }),
  );
}

export async function apiSocialSnapshot() {
  const { emptySocial } = await import("@/shared/lib/social");
  try {
    return await withAuthRetry((token) =>
      invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_snapshot", { token }),
    );
  } catch (error) {
    if (!isTauri()) return emptySocial();
    throw error;
  }
}

export async function apiSocialRequest(username: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_request", { token, username }),
  );
}

export async function apiSocialRespond(requestId: string, accept: boolean) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_respond", {
      token,
      requestId,
      accept,
    }),
  );
}

export async function apiSocialSend(peerId: string, text: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_send", { token, peerId, text }),
  );
}

export async function apiSocialRead(peerId: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_read", { token, peerId }),
  );
}

export async function apiSocialDelete(peerId: string, messageId: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_delete_message", {
      token,
      peerId,
      messageId,
    }),
  );
}

export async function apiSocialReact(peerId: string, messageId: string, emoji: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_react", {
      token,
      peerId,
      messageId,
      emoji,
    }),
  );
}

export async function apiSocialDeleteThread(peerId: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_delete_thread", { token, peerId }),
  );
}

export async function apiSocialTyping(peerId: string, active: boolean) {
  await withAuthRetry((token) => invoke("cloud_social_typing", { token, peerId, active }));
}

export async function apiSocialBlock(userId: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_block", { token, userId }),
  );
}

export async function apiSocialUnblock(userId: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_unblock", { token, userId }),
  );
}

export async function apiSocialRemoveFriend(userId: string) {
  return withAuthRetry((token) =>
    invoke<import("@/shared/lib/social").SocialSnapshot>("cloud_social_remove_friend", { token, userId }),
  );
}

export async function apiGetProgression(): Promise<unknown> {
  return withAuthRetry((token) => invoke("cloud_get_progression", { token }));
}

export async function apiPutProgression(progression: unknown): Promise<unknown> {
  return withAuthRetry((token) => invoke("cloud_put_progression", { token, progression }));
}

export async function apiPublicProfile(userId: string): Promise<PublicProfile> {
  return withAuthRetry((token) => invoke<PublicProfile>("cloud_public_profile", { token, userId }));
}

export async function apiAchievementRates(): Promise<AchievementRate[]> {
  return withAuthRetry((token) => invoke<AchievementRate[]>("cloud_achievement_rates", { token }));
}

export async function flashTaskbar(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("flash_taskbar");
  } catch {
    /* indicateur facultatif */
  }
}

export async function apiDeleteAccount(password: string): Promise<void> {
  await withAuthRetry((token) => invoke("delete_account", { token, password }));
}
