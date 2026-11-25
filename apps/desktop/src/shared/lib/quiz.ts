import type { QaLanguageProgress } from "@/shared/lib/tauri";

export function emptyQa(poolSize: number): QaLanguageProgress {
  return {
    correctIds: [],
    failedIds: [],
    attempts: 0,
    correctAttempts: 0,
    timeSpentMs: 0,
    completionMs: null,
    poolSize,
  };
}

export function normalizeQa(
  raw: QaLanguageProgress | undefined,
  poolSize: number,
): QaLanguageProgress {
  return {
    correctIds: raw?.correctIds ?? [],
    failedIds: raw?.failedIds ?? [],
    attempts: raw?.attempts ?? 0,
    correctAttempts: raw?.correctAttempts ?? 0,
    timeSpentMs: raw?.timeSpentMs ?? 0,
    completionMs: raw?.completionMs ?? null,
    poolSize,
  };
}

/** Une mauvaise réponse est écartée tout de suite. Elle revient quand il ne reste qu'elle. */
export function pickNextQuestionId(
  allIds: string[],
  correctIds: string[],
  failedIds: string[],
  excludeId: string | null,
): string | null {
  const mastered = new Set(correctIds);
  const pending = allIds.filter((id) => !mastered.has(id));
  if (pending.length === 0) return null;
  const withoutExcluded = excludeId ? pending.filter((id) => id !== excludeId) : pending;
  const pool = withoutExcluded.length > 0 ? withoutExcluded : pending;
  const fresh = pool.filter((id) => !failedIds.includes(id));
  const choices = fresh.length > 0 ? fresh : pool;
  const index = Math.floor(Math.random() * choices.length);
  return choices[index] ?? null;
}

export function applyQaAnswer(
  state: QaLanguageProgress,
  questionId: string,
  correct: boolean,
  elapsedMs: number,
  poolSize: number,
): QaLanguageProgress {
  const correctIds = new Set(state.correctIds);
  const failedIds = new Set(state.failedIds);
  if (correct) {
    correctIds.add(questionId);
    failedIds.delete(questionId);
  } else {
    failedIds.add(questionId);
  }
  const timeSpentMs = state.timeSpentMs + Math.max(0, elapsedMs);
  const mastered = poolSize > 0 && correctIds.size >= poolSize;
  return {
    correctIds: [...correctIds],
    failedIds: [...failedIds],
    attempts: state.attempts + 1,
    correctAttempts: state.correctAttempts + (correct ? 1 : 0),
    timeSpentMs,
    completionMs: state.completionMs ?? (mastered ? timeSpentMs : null),
    poolSize,
  };
}

export function qaAccuracy(state: QaLanguageProgress): number {
  if (!state.attempts) return 0;
  return Math.round((state.correctAttempts / state.attempts) * 100);
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes <= 0) return `${seconds} s`;
  return `${minutes} min ${seconds.toString().padStart(2, "0")} s`;
}
