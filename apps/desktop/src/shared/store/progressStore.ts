import { create } from "zustand";
import {
  completeExercise,
  completeLesson,
  markTutorialSeen as persistTutorialSeen,
  saveQaProgress,
  type ProgressSnapshot,
  type QaLanguageProgress,
  setLastLesson,
  setSetupDone,
  setTheme,
} from "@/shared/lib/tauri";
import { normalizeTheme, type ThemeId } from "@/shared/lib/theme";
import { pushProgressToCloud, syncProgressFromCloud } from "@/shared/lib/sync";

type ProgressState = {
  ready: boolean;
  progress: ProgressSnapshot;
  focusMode: boolean;
  load: () => Promise<void>;
  markLesson: (lessonId: string, language: string, label: string) => Promise<void>;
  markExercise: (
    exerciseId: string,
    language: string,
    label: string,
  ) => Promise<void>;
  rememberLesson: (lessonId: string, language: string) => Promise<void>;
  updateTheme: (theme: ThemeId) => Promise<void>;
  markSetupDone: () => Promise<void>;
  setFocusMode: (value: boolean) => void;
  recordQa: (language: string, state: QaLanguageProgress) => Promise<void>;
  markTutorialSeen: (lessonId: string) => Promise<void>;
  reset: () => void;
};

const empty: ProgressSnapshot = {
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

async function afterLocalChange(progress: ProgressSnapshot) {
  return pushProgressToCloud(progress);
}

export const useProgressStore = create<ProgressState>((set, get) => ({
  ready: false,
  progress: empty,
  focusMode: false,
  load: async () => {
    set({ ready: false });
    const progress = await syncProgressFromCloud();
    document.documentElement.setAttribute(
      "data-theme",
      normalizeTheme(progress.theme),
    );
    set({ progress, ready: true });
  },
  markLesson: async (lessonId, language, label) => {
    let progress = await completeLesson(lessonId, language, label);
    progress = await afterLocalChange(progress);
    set({ progress });
  },
  markExercise: async (exerciseId, language, label) => {
    let progress = await completeExercise(exerciseId, language, label);
    progress = await afterLocalChange(progress);
    set({ progress });
  },
  rememberLesson: async (lessonId, language) => {
    await setLastLesson(lessonId, language);
    const progress = await afterLocalChange({
      ...get().progress,
      lastLessonId: lessonId,
      lastLanguage: language,
      updatedAt: new Date().toISOString(),
    });
    set({ progress });
  },
  updateTheme: async (theme) => {
    await setTheme(theme);
    document.documentElement.setAttribute("data-theme", theme);
    const progress = await afterLocalChange({
      ...get().progress,
      theme,
      updatedAt: new Date().toISOString(),
    });
    set({ progress });
  },
  markSetupDone: async () => {
    await setSetupDone(true);
    const progress = await afterLocalChange({
      ...get().progress,
      setupDone: true,
      updatedAt: new Date().toISOString(),
    });
    set({ progress });
  },
  setFocusMode: (value) => set({ focusMode: value }),
  recordQa: async (language, state) => {
    const qa = { ...(get().progress.qa ?? {}), [language]: state };
    let progress = await saveQaProgress(qa);
    progress = await afterLocalChange(progress);
    set({ progress });
  },
  markTutorialSeen: async (lessonId) => {
    let progress = await persistTutorialSeen(lessonId);
    progress = await afterLocalChange(progress);
    set({ progress });
  },
  reset: () => {
    document.documentElement.setAttribute("data-theme", "dark");
    set({ progress: empty, ready: false, focusMode: false });
  },
}));
