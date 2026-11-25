import {
  apiGetProgress,
  apiPutProgress,
  ensureStoredToken,
} from "@/shared/lib/api";
import {
  getProgress,
  replaceProgress,
  type ProgressSnapshot,
} from "@/shared/lib/tauri";
import { normalizeTheme } from "@/shared/lib/theme";

function withUpdatedAt(progress: ProgressSnapshot): ProgressSnapshot & {
  updatedAt: string;
} {
  return {
    ...progress,
    updatedAt: progress.updatedAt || new Date().toISOString(),
  };
}

/** Fusion last-write-wins puis écriture locale + push si besoin. */
export async function syncProgressFromCloud(): Promise<ProgressSnapshot> {
  const local = await getProgress();
  if (!(await ensureStoredToken())) return local;

  try {
    const remote = await apiGetProgress();
    const localAt = local.updatedAt || "";
    const remoteAt = remote.updatedAt || "";

    if (remoteAt && (!localAt || remoteAt > localAt)) {
      const applied = await replaceProgress({
        completedLessons: remote.completedLessons || [],
        completedExercises: remote.completedExercises || [],
        lastLessonId: remote.lastLessonId ?? null,
        lastLanguage: remote.lastLanguage ?? null,
        dailyGoal: remote.dailyGoal ?? 3,
        dailyCount: remote.dailyCount ?? 0,
        dailyDate: remote.dailyDate || new Date().toISOString().slice(0, 10),
        history: remote.history || [],
        setupDone: Boolean(remote.setupDone),
        theme: normalizeTheme(remote.theme),
        updatedAt: remoteAt,
        qa: remote.qa ?? local.qa ?? {},
        tutorialSeen: Array.isArray(remote.tutorialSeen)
          ? remote.tutorialSeen
          : (local.tutorialSeen ?? []),
      });
      return applied;
    }

    if (localAt && (!remoteAt || localAt > remoteAt)) {
      await apiPutProgress(withUpdatedAt(local));
    } else if (!remoteAt && (local.completedLessons.length > 0 || local.completedExercises.length > 0)) {
      // Serveur vide : pousser la progression locale.
      const stamped = withUpdatedAt({
        ...local,
        updatedAt: new Date().toISOString(),
      });
      await replaceProgress(stamped);
      await apiPutProgress(stamped);
      return stamped;
    }

    return local;
  } catch {
    return local;
  }
}

export async function pushProgressToCloud(
  progress: ProgressSnapshot,
): Promise<ProgressSnapshot> {
  const stamped = withUpdatedAt({
    ...progress,
    updatedAt: new Date().toISOString(),
  });
  if (!(await ensureStoredToken())) return stamped;
  try {
    const remote = await apiPutProgress(stamped);
    if (remote.rejected && remote.updatedAt) {
      return replaceProgress({
        ...remote,
        qa: remote.qa ?? progress.qa ?? {},
        tutorialSeen: Array.isArray(remote.tutorialSeen)
          ? remote.tutorialSeen
          : (progress.tutorialSeen ?? []),
        updatedAt: remote.updatedAt,
      });
    }
  } catch {
    /* hors ligne : cache local suffit */
  }
  return stamped;
}
