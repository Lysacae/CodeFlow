import { create } from "zustand";
import { ACHIEVEMENTS } from "@/shared/lib/achievements";
import {
  apiAchievementRates,
  apiGetProgression,
  apiPutProgression,
} from "@/shared/lib/api";
import type { LearningState } from "@/shared/lib/learning";
import { emptyLearning } from "@/shared/lib/learning";
import {
  absorbActivity,
  applyStatPatch,
  emptyProgression,
  evaluateProgression,
  mergeProgression,
  normalizeProgression,
  progressionSignature,
  type ProgressionDoc,
  type StatPatch,
} from "@/shared/lib/progression";
import { listPrograms } from "@/shared/lib/tauri";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { useSocialStore } from "@/shared/store/socialStore";

export type UnlockToast = { key: string; id: string; title: string };

type ProgressionState = {
  ready: boolean;
  bootstrapped: boolean;
  doc: ProgressionDoc;
  rates: Record<string, number>;
  unlocks: UnlockToast[];
  reviewTutorial: boolean;
  tutorialLanguage: string | null;
  load: (userId: string) => Promise<void>;
  reconcile: () => Promise<void>;
  record: (patch: StatPatch) => void;
  updateLearning: (mutate: (learning: LearningState) => LearningState) => void;
  markTutorial: () => Promise<void>;
  openTutorial: (languageId?: string | null) => void;
  closeTutorial: () => void;
  dismissUnlock: (key: string) => void;
  reset: () => void;
};

let seq = 0;
let userId = "";

function storageKey(id: string) {
  return `cf-prog-${id}`;
}

function readLocal(id: string): ProgressionDoc | null {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (!raw) return null;
    return normalizeProgression(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocal(id: string, doc: ProgressionDoc) {
  if (!id) return;
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(doc));
  } catch {
    /* quota */
  }
}

function pushUnlocks(next: string[], canToast: boolean, seen: Set<string>) {
  if (!canToast) return;
  const fresh = next.filter((id) => !seen.has(id));
  if (!fresh.length) return;
  for (const id of fresh) seen.add(id);
  const items: UnlockToast[] = fresh.map((id) => ({
    key: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    id,
    title: ACHIEVEMENTS.find((item) => item.id === id)?.title ?? "Succès",
  }));
  const { unlocks } = useProgressionStore.getState();
  useProgressionStore.setState({ unlocks: [...unlocks, ...items].slice(-3) });
  window.setTimeout(() => {
    const keys = new Set(items.map((item) => item.key));
    useProgressionStore.setState({
      unlocks: useProgressionStore.getState().unlocks.filter((item) => !keys.has(item.key)),
    });
  }, 4200);
}

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  ready: false,
  bootstrapped: false,
  doc: emptyProgression(),
  rates: {},
  unlocks: [],
  reviewTutorial: false,
  tutorialLanguage: null,
  load: async (id) => {
    userId = id;
    const local = readLocal(id) ?? emptyProgression();
    set({ doc: local, ready: false, bootstrapped: false, reviewTutorial: false, unlocks: [] });
    try {
      const remote = normalizeProgression(await apiGetProgression());
      const merged = mergeProgression(local, remote);
      set({ doc: merged });
      writeLocal(id, merged);
    } catch {
      /* hors ligne : cache local */
    }
    set({ ready: true });
    await get().reconcile();
    if (userId === id) set({ bootstrapped: true });
    void apiAchievementRates()
      .then((rows) => {
        const rates: Record<string, number> = {};
        for (const row of rows) rates[row.id] = row.percent;
        set({ rates });
      })
      .catch(() => undefined);
  },
  reconcile: async () => {
    const id = ++seq;
    const currentUser = userId;
    if (!currentUser) return;
    const before = get().doc.achievements;
    const canToast = get().bootstrapped;
    const seen = new Set(before);
    const progress = useProgressStore.getState().progress;
    const user = useAuthStore.getState().user;
    const friends = useSocialStore.getState().snapshot.friends.length;
    let programs: { language: string }[] = [];
    try {
      programs = await listPrograms();
    } catch {
      programs = [];
    }
    if (id !== seq) return;
    const extras = {
      hasAvatar: Boolean(user?.avatarData),
      friendCount: friends,
      programCount: programs.length,
      programLangs: new Set(programs.map((program) => program.language)).size,
    };
    const absorbed = absorbActivity(get().doc, progress, extras);
    const next = evaluateProgression(absorbed, progress, extras);
    if (progressionSignature(next) === progressionSignature(get().doc)) {
      if (!get().ready) set({ ready: true });
      return;
    }
    set({ doc: next, ready: true });
    pushUnlocks(next.achievements, canToast, seen);
    writeLocal(currentUser, next);
    try {
      const saved = normalizeProgression(await apiPutProgression(next));
      if (id !== seq) return;
      const merged = evaluateProgression(
        absorbActivity(mergeProgression(next, saved), progress, extras),
        progress,
        extras,
      );
      set({ doc: merged });
      pushUnlocks(merged.achievements, canToast, seen);
      writeLocal(currentUser, merged);
      if (id === seq && progressionSignature(merged) !== progressionSignature(next)) {
        await apiPutProgression(merged);
      }
    } catch {
      /* le cache local suffit hors ligne */
    }
  },
  record: (patch) => {
    set({ doc: applyStatPatch(get().doc, patch) });
    void get().reconcile();
  },
  updateLearning: (mutate) => {
    const current = get().doc;
    const learning = mutate(current.learning ?? emptyLearning());
    set({ doc: { ...current, learning } });
    void get().reconcile();
  },
  markTutorial: async () => {
    const doc = applyStatPatch(get().doc, { tutorial: true });
    doc.tutorialDone = true;
    doc.stats.tutorial = true;
    set({ doc, reviewTutorial: false });
    writeLocal(userId, doc);
    await get().reconcile();
  },
  openTutorial: (languageId) =>
    set({ reviewTutorial: true, tutorialLanguage: languageId ?? null }),
  closeTutorial: () => set({ reviewTutorial: false }),
  dismissUnlock: (key) => set({ unlocks: get().unlocks.filter((item) => item.key !== key) }),
  reset: () => {
    seq += 1;
    userId = "";
    set({
      ready: false,
      bootstrapped: false,
      doc: emptyProgression(),
      rates: {},
      unlocks: [],
      reviewTutorial: false,
      tutorialLanguage: null,
    });
  },
}));
