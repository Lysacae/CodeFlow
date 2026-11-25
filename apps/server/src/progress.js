import { supabaseFetch } from "./supabase.js";

const emptySnapshot = () => ({
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
  updatedAt: new Date(0).toISOString(),
});

function readProgress(user) {
  const raw = user?.app_metadata?.progress;
  if (!raw || typeof raw !== "object") return emptySnapshot();
  return {
    ...emptySnapshot(),
    ...raw,
    updatedAt: raw.updatedAt || new Date(0).toISOString(),
  };
}

export async function getProgress(user) {
  // Recharge admin pour app_metadata complet
  const full = await supabaseFetch(`/auth/v1/admin/users/${user.id}`);
  return readProgress(full);
}

export async function putProgress(user, body) {
  const incoming = body && typeof body === "object" ? body : {};
  const incomingAt = incoming.updatedAt || new Date().toISOString();
  const full = await supabaseFetch(`/auth/v1/admin/users/${user.id}`);
  const current = readProgress(full);

  if (current.updatedAt && current.updatedAt > incomingAt) {
    return { ...current, rejected: true };
  }

  const snapshot = {
    completedLessons: incoming.completedLessons || [],
    completedExercises: incoming.completedExercises || [],
    lastLessonId: incoming.lastLessonId ?? null,
    lastLanguage: incoming.lastLanguage ?? null,
    dailyGoal: Number(incoming.dailyGoal) || 3,
    dailyCount: Number(incoming.dailyCount) || 0,
    dailyDate: incoming.dailyDate || new Date().toISOString().slice(0, 10),
    history: Array.isArray(incoming.history) ? incoming.history.slice(0, 50) : [],
    setupDone: Boolean(incoming.setupDone),
    theme: incoming.theme === "light" ? "light" : "dark",
    updatedAt: incomingAt,
  };

  await supabaseFetch(`/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    body: {
      app_metadata: {
        ...(full.app_metadata || {}),
        progress: snapshot,
      },
    },
  });

  return snapshot;
}
