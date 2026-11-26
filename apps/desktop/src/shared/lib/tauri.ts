import { invoke } from "@tauri-apps/api/core";

export type ExecuteResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  compileOutput: string | null;
};

export type RuntimeStatus = {
  id: string;
  name: string;
  installed: boolean;
  version: string | null;
  path: string | null;
  wingetId: string;
};

export type HistoryEntry = {
  id: string;
  kind: string;
  label: string;
  at: string;
};

export type QaLanguageProgress = {
  correctIds: string[];
  failedIds: string[];
  attempts: number;
  correctAttempts: number;
  timeSpentMs: number;
  completionMs: number | null;
  poolSize: number;
};

export type ProgressSnapshot = {
  completedLessons: string[];
  completedExercises: string[];
  lastLessonId: string | null;
  lastLanguage: string | null;
  dailyGoal: number;
  dailyCount: number;
  dailyDate: string;
  history: HistoryEntry[];
  setupDone: boolean;
  theme: string;
  updatedAt?: string | null;
  qa?: Record<string, QaLanguageProgress>;
  tutorialSeen?: string[];
};

export type SavedProgram = {
  id: string;
  name: string;
  language: string;
  fileName: string;
  code: string;
  updatedAt: string;
};

export type UserPublic = {
  id: string;
  username: string;
  avatarData: string | null;
};

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const memoryProgress: ProgressSnapshot = {
  completedLessons: [],
  completedExercises: [],
  lastLessonId: null,
  lastLanguage: null,
  dailyGoal: 3,
  dailyCount: 0,
  dailyDate: new Date().toISOString().slice(0, 10),
  history: [],
  setupDone: false,
  theme: "dark",
  qa: {},
  tutorialSeen: [],
};

const memoryPrograms: SavedProgram[] = [];

export type TraceVar = {
  name: string;
  typeName: string;
  value: string;
};

export type TraceEvent = {
  line: number;
  event: string;
  function: string;
  locals: TraceVar[];
  returned: string | null;
};

export type TraceResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  limited: boolean;
  limitation: string | null;
  events: TraceEvent[];
};

export async function traceCode(input: {
  language: string;
  code: string;
  fileName?: string;
  timeoutSecs?: number;
}): Promise<TraceResult> {
  if (!isTauri()) {
    return {
      success: false,
      stdout: "",
      stderr: "Le pas à pas réel est disponible dans l'application bureau CodeFlow.",
      timedOut: false,
      limited: true,
      limitation: "Le pas à pas réel est disponible dans l'application bureau CodeFlow.",
      events: [],
    };
  }
  return invoke<TraceResult>("trace_code", { request: input });
}

export async function executeCode(input: {
  language: string;
  code: string;
  fileName?: string;
  timeoutSecs?: number;
}): Promise<ExecuteResult> {
  if (!isTauri()) {
    return {
      success: false,
      stdout: "",
      stderr:
        "L'exécution réelle est disponible dans l'application bureau CodeFlow (tauri:dev).",
      exitCode: null,
      timedOut: false,
      compileOutput: null,
    };
  }
  return invoke<ExecuteResult>("execute_code", { request: input });
}

export async function detectRuntimes(): Promise<RuntimeStatus[]> {
  if (!isTauri()) {
    return [
      {
        id: "python",
        name: "Python",
        installed: false,
        version: null,
        path: null,
        wingetId: "Python.Python.3.12",
      },
      {
        id: "dotnet",
        name: ".NET SDK",
        installed: false,
        version: null,
        path: null,
        wingetId: "Microsoft.DotNet.SDK.8",
      },
      {
        id: "cpp",
        name: "Compilateur C++",
        installed: false,
        version: null,
        path: null,
        wingetId: "MartinStorsjo.LLVM-MinGW.UCRT",
      },
      {
        id: "java",
        name: "JDK (Java)",
        installed: false,
        version: null,
        path: null,
        wingetId: "EclipseAdoptium.Temurin.21.JDK",
      },
    ];
  }
  return invoke<RuntimeStatus[]>("detect_runtimes");
}

export async function installRuntime(runtimeId: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Installation disponible uniquement dans l'application bureau.");
  }
  return invoke<string>("install_runtime", { runtimeId });
}

export async function uninstallRuntime(runtimeId: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Désinstallation disponible uniquement dans l'application bureau.");
  }
  return invoke<string>("uninstall_runtime", { runtimeId });
}

export async function getProgress(): Promise<ProgressSnapshot> {
  if (!isTauri()) return structuredClone(memoryProgress);
  return invoke<ProgressSnapshot>("get_progress");
}

export async function completeLesson(
  lessonId: string,
  language: string,
  label: string,
): Promise<ProgressSnapshot> {
  if (!isTauri()) {
    if (!memoryProgress.completedLessons.includes(lessonId)) {
      memoryProgress.completedLessons.push(lessonId);
      memoryProgress.dailyCount += 1;
    }
    memoryProgress.lastLessonId = lessonId;
    memoryProgress.lastLanguage = language;
    return structuredClone(memoryProgress);
  }
  return invoke<ProgressSnapshot>("complete_lesson", {
    lessonId,
    language,
    label,
  });
}

export async function completeExercise(
  exerciseId: string,
  language: string,
  label: string,
): Promise<ProgressSnapshot> {
  if (!isTauri()) {
    if (!memoryProgress.completedExercises.includes(exerciseId)) {
      memoryProgress.completedExercises.push(exerciseId);
      memoryProgress.dailyCount += 1;
    }
    memoryProgress.lastLanguage = language;
    return structuredClone(memoryProgress);
  }
  return invoke<ProgressSnapshot>("complete_exercise", {
    exerciseId,
    language,
    label,
  });
}

export async function setLastLesson(
  lessonId: string,
  language: string,
): Promise<void> {
  if (!isTauri()) {
    memoryProgress.lastLessonId = lessonId;
    memoryProgress.lastLanguage = language;
    return;
  }
  await invoke("set_last_lesson", { lessonId, language });
}

export async function setTheme(theme: string): Promise<void> {
  if (!isTauri()) {
    memoryProgress.theme = theme;
    return;
  }
  await invoke("set_theme", { theme });
}

export async function setSetupDone(done: boolean): Promise<void> {
  if (!isTauri()) {
    memoryProgress.setupDone = done;
    return;
  }
  await invoke("set_setup_done", { done });
}

export async function listPrograms(): Promise<SavedProgram[]> {
  if (!isTauri()) return structuredClone(memoryPrograms);
  return invoke<SavedProgram[]>("list_programs");
}

export async function saveProgram(input: {
  id?: string;
  name: string;
  language: string;
  fileName: string;
  code: string;
}): Promise<SavedProgram> {
  if (!isTauri()) {
    const program: SavedProgram = {
      id: input.id ?? crypto.randomUUID(),
      name: input.name,
      language: input.language,
      fileName: input.fileName,
      code: input.code,
      updatedAt: new Date().toISOString(),
    };
    const idx = memoryPrograms.findIndex((p) => p.id === program.id);
    if (idx >= 0) memoryPrograms[idx] = program;
    else memoryPrograms.unshift(program);
    return program;
  }
  return invoke<SavedProgram>("save_program", input);
}

export async function writeUserFile(path: string, code: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("Enregistrement disponible dans l'application bureau.");
  }
  return invoke<string>("write_user_file", { path, code });
}

export function normalizeStdout(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

export function stdoutMatches(actual: string, expected: string): boolean {
  return normalizeStdout(actual) === normalizeStdout(expected);
}

let memoryUser: UserPublic | null = null;

export async function getSession(): Promise<UserPublic | null> {
  if (!isTauri()) return memoryUser;
  return invoke<UserPublic | null>("get_session");
}

export async function setCloudSession(input: {
  id: string;
  username: string;
  avatarData?: string | null;
  token: string;
  refreshToken?: string | null;
}): Promise<UserPublic> {
  if (!isTauri()) {
    memoryUser = {
      id: input.id,
      username: input.username,
      avatarData: input.avatarData ?? null,
    };
    return memoryUser;
  }
  return invoke<UserPublic>("set_cloud_session", {
    id: input.id,
    username: input.username,
    avatarData: input.avatarData ?? null,
    token: input.token,
    refreshToken: input.refreshToken ?? null,
  });
}

export async function logoutUser(): Promise<void> {
  if (!isTauri()) {
    memoryUser = null;
    return;
  }
  await invoke("logout_user");
}

export async function listUsers(): Promise<UserPublic[]> {
  if (!isTauri()) return memoryUser ? [memoryUser] : [];
  return invoke<UserPublic[]>("list_users");
}

export async function replaceProgress(
  snapshot: ProgressSnapshot,
): Promise<ProgressSnapshot> {
  if (!isTauri()) {
    Object.assign(memoryProgress, snapshot);
    return { ...memoryProgress };
  }
  return invoke<ProgressSnapshot>("replace_progress", { snapshot });
}

export async function saveQaProgress(
  qa: Record<string, QaLanguageProgress>,
): Promise<ProgressSnapshot> {
  if (!isTauri()) {
    memoryProgress.qa = qa;
    memoryProgress.updatedAt = new Date().toISOString();
    return structuredClone(memoryProgress);
  }
  return invoke<ProgressSnapshot>("save_qa_progress", { qa });
}

export async function downloadAndRunUpdate(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank");
    return;
  }
  await invoke("download_and_run_update", { url });
}

export async function openUpdateUrl(url: string): Promise<void> {
  if (!isTauri()) {
    window.open(url, "_blank");
    return;
  }
  await invoke("open_update_url", { url });
}

export async function environmentsOnboardingDone(): Promise<boolean> {
  if (!isTauri()) return true;
  return invoke<boolean>("environments_onboarding_done");
}

export async function markEnvironmentsOnboardingDone(): Promise<void> {
  if (!isTauri()) return;
  await invoke("mark_environments_onboarding_done");
}

export async function saveLocalRecovery(username: string, password: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("save_local_recovery", { username, password });
}

export async function updateRecoveryUsername(previous: string, username: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("update_recovery_username", { previous, username });
}

export async function recoverLocalPassword(username: string): Promise<string> {
  if (!isTauri()) {
    throw new Error("La récupération est disponible dans l'application CodeFlow.");
  }
  return invoke<string>("recover_local_password", { username });
}

export async function markTutorialSeen(lessonId: string): Promise<ProgressSnapshot> {
  if (!isTauri()) {
    const seen = new Set(memoryProgress.tutorialSeen ?? []);
    seen.add(lessonId);
    memoryProgress.tutorialSeen = [...seen];
    memoryProgress.updatedAt = new Date().toISOString();
    return structuredClone(memoryProgress);
  }
  return invoke<ProgressSnapshot>("mark_tutorial_seen", { lessonId });
}

export type Diagnostics = {
  version: string;
  elevated: boolean;
  wingetPath: string;
  dbPath: string;
  appData: string;
  projectsDir: string;
  sandboxDir: string;
  runtimes: RuntimeStatus[];
  recentErrors: string[];
};

export async function devListAccounts(): Promise<UserPublic[]> {
  if (!isTauri()) return [];
  return invoke<UserPublic[]>("dev_list_accounts");
}

export async function devDeleteAccount(userId: string): Promise<void> {
  if (!isTauri()) return;
  await invoke("dev_delete_account", { userId });
}

export async function devResetRank(userId: string, achievementIds: string[]): Promise<unknown> {
  if (!isTauri()) return {};
  return invoke("dev_reset_rank", { userId, achievementIds });
}

export async function devGetProgression(userId: string): Promise<unknown> {
  if (!isTauri()) return {};
  return invoke("dev_get_progression", { userId });
}

export async function devUnlockAchievements(
  userId: string,
  ids: string[],
  xpById: Record<string, number>,
): Promise<unknown> {
  if (!isTauri()) return {};
  return invoke("dev_unlock_achievements", { userId, ids, xpById });
}

export async function devResetSession(): Promise<ProgressSnapshot> {
  if (!isTauri()) return structuredClone(memoryProgress);
  return invoke<ProgressSnapshot>("dev_reset_session");
}

export async function devDiagnostics(): Promise<Diagnostics> {
  if (!isTauri()) {
    return {
      version: "web",
      elevated: false,
      wingetPath: "",
      dbPath: "",
      appData: "",
      projectsDir: "",
      sandboxDir: "",
      runtimes: [],
      recentErrors: [],
    };
  }
  return invoke<Diagnostics>("dev_diagnostics");
}

export async function recoverLocalUsername(): Promise<string> {
  if (!isTauri()) {
    throw new Error("La récupération est disponible dans l'application CodeFlow.");
  }
  return invoke<string>("recover_local_username");
}

