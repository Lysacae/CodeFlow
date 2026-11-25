import { create } from "zustand";
import {
  apiDeleteAccount,
  apiLogin,
  apiMe,
  apiRegister,
  apiUpdatePassword,
  apiUpdateProfile,
  ensureStoredToken,
  getStoredRefresh,
  getStoredToken,
  setStoredRefresh,
  setStoredToken,
} from "@/shared/lib/api";
import { useProgressStore } from "@/shared/store/progressStore";
import {
  getSession,
  logoutUser,
  saveLocalRecovery,
  setCloudSession,
  updateRecoveryUsername,
  type UserPublic,
} from "@/shared/lib/tauri";

type AuthState = {
  ready: boolean;
  user: UserPublic | null;
  loadSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    password: string,
    avatarData?: string | null,
  ) => Promise<void>;
  updateProfile: (input: {
    username: string;
    avatarData?: string | null;
  }) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

async function applyCloudSession(
  user: UserPublic,
  token: string,
  refreshToken?: string | null,
): Promise<UserPublic> {
  setStoredToken(token);
  if (refreshToken) setStoredRefresh(refreshToken);
  return setCloudSession({
    id: user.id,
    username: user.username,
    avatarData: user.avatarData,
    token,
    refreshToken: refreshToken ?? null,
  });
}

async function rememberAccount(username: string, password: string) {
  try {
    await saveLocalRecovery(username, password);
  } catch {
    /* le fichier local ne doit pas bloquer la connexion */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ready: false,
  user: null,
  loadSession: async () => {
    const token = await ensureStoredToken();
    const cached = await getSession();

    if (token) {
      try {
        const { user } = await apiMe();
        const local = await applyCloudSession(user, token, getStoredRefresh());
        set({ user: local, ready: true });
        return;
      } catch {
        if (!cached) {
          setStoredToken(null);
        }
      }
    }

    set({ user: cached, ready: true });
  },
  login: async (username, password) => {
    const { user, token, refreshToken } = await apiLogin({ username, password });
    const local = await applyCloudSession(user, token, refreshToken);
    set({ user: local });
    await rememberAccount(local.username, password);
  },
  register: async (username, password, avatarData) => {
    const { user, token, refreshToken } = await apiRegister({
      username,
      password,
      avatarData,
    });
    const local = await applyCloudSession(user, token, refreshToken);
    set({ user: local });
    await rememberAccount(local.username, password);
  },
  updateProfile: async (input) => {
    const token = getStoredToken();
    if (!token) throw new Error("Non authentifié.");
    const previous = get().user?.username ?? "";
    const user = await apiUpdateProfile(input);
    const local = await applyCloudSession(user, token, getStoredRefresh());
    set({ user: local });
    if (previous && previous !== local.username) {
      try {
        await updateRecoveryUsername(previous, local.username);
      } catch {
        /* récupération locale facultative */
      }
    }
  },
  updatePassword: async (currentPassword, newPassword) => {
    await apiUpdatePassword(currentPassword, newPassword);
    const username = get().user?.username;
    if (username) await rememberAccount(username, newPassword);
  },
  deleteAccount: async (password) => {
    try {
      await apiDeleteAccount(password);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.startsWith("Compte supprimé")) throw error;
    }
    setStoredToken(null);
    setStoredRefresh(null);
    try {
      await logoutUser();
    } catch {
      /* la session sqlite est déjà effacée après une suppression réussie */
    }
    useProgressStore.getState().reset();
    set({ user: null });
  },
  logout: async () => {
    setStoredToken(null);
    setStoredRefresh(null);
    await logoutUser();
    set({ user: null });
  },
}));
