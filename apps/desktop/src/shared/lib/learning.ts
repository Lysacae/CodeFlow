import type { JournalEntry } from "@/shared/lib/errorJournal";
import { upsertJournal } from "@/shared/lib/errorJournal";
import {
  applyReview,
  emptyNotion,
  isDue,
  isLowMastery,
  masteryScore,
  type NotionCard,
  type ReviewInput,
} from "@/shared/lib/review";

export type LearningState = {
  notions: Record<string, NotionCard>;
  journal: JournalEntry[];
};

export function emptyLearning(): LearningState {
  return { notions: {}, journal: [] };
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeLearning(raw: unknown): LearningState {
  const base = emptyLearning();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const notionsRaw = data.notions;
  if (notionsRaw && typeof notionsRaw === "object") {
    for (const [key, value] of Object.entries(notionsRaw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const card = value as Record<string, unknown>;
      const languageId = typeof card.languageId === "string" ? card.languageId : key.split(":")[0] ?? "";
      const lessonId = typeof card.lessonId === "string" ? card.lessonId : key.split(":").slice(1).join(":");
      if (!languageId || !lessonId) continue;
      const notion: NotionCard = {
        id: key,
        languageId,
        lessonId,
        exerciseId: typeof card.exerciseId === "string" ? card.exerciseId : null,
        title: typeof card.title === "string" ? card.title : lessonId,
        chapter: num(card.chapter, 1),
        successes: Math.max(0, Math.floor(num(card.successes))),
        failures: Math.max(0, Math.floor(num(card.failures))),
        hintsUsed: Math.max(0, Math.floor(num(card.hintsUsed))),
        solutionsSeen: Math.max(0, Math.floor(num(card.solutionsSeen))),
        ease: Math.max(1.3, num(card.ease, 2.5)),
        intervalDays: Math.max(0, Math.floor(num(card.intervalDays))),
        mastery: Math.max(0, Math.min(100, Math.floor(num(card.mastery)))),
        lastReviewAt: typeof card.lastReviewAt === "string" ? card.lastReviewAt : null,
        nextReviewAt: typeof card.nextReviewAt === "string" ? card.nextReviewAt : new Date().toISOString(),
        lapses: Math.max(0, Math.floor(num(card.lapses))),
      };
      base.notions[key] = notion;
    }
  }
  if (Array.isArray(data.journal)) {
    base.journal = data.journal
      .filter((item): item is JournalEntry => {
        if (!item || typeof item !== "object") return false;
        const row = item as JournalEntry;
        return typeof row.id === "string" && typeof row.lessonId === "string" && typeof row.kind === "string";
      })
      .slice(0, 60);
  }
  return base;
}

function attemptsOf(card: NotionCard): number {
  return card.successes + card.failures;
}

export function mergeLearning(local: LearningState, remote: LearningState): LearningState {
  const notions: Record<string, NotionCard> = {};
  const keys = new Set([...Object.keys(local.notions), ...Object.keys(remote.notions)]);
  for (const key of keys) {
    const a = local.notions[key];
    const b = remote.notions[key];
    if (!a) {
      notions[key] = b;
      continue;
    }
    if (!b) {
      notions[key] = a;
      continue;
    }
    const aTime = a.lastReviewAt ?? "";
    const bTime = b.lastReviewAt ?? "";
    const newer = bTime > aTime ? b : a;
    const busier = attemptsOf(a) >= attemptsOf(b) ? a : b;
    const chosen = attemptsOf(busier) > attemptsOf(newer) ? busier : newer;
    const merged: NotionCard = {
      ...chosen,
      successes: Math.max(a.successes, b.successes),
      failures: Math.max(a.failures, b.failures),
      hintsUsed: Math.max(a.hintsUsed, b.hintsUsed),
      solutionsSeen: Math.max(a.solutionsSeen, b.solutionsSeen),
      lapses: Math.max(a.lapses, b.lapses),
      ease: chosen.ease,
      intervalDays: chosen.intervalDays,
      lastReviewAt: chosen.lastReviewAt,
      nextReviewAt: chosen.nextReviewAt,
      mastery: 0,
    };
    merged.mastery = masteryScore(merged);
    notions[key] = merged;
  }

  const byId = new Map<string, JournalEntry>();
  for (const entry of [...remote.journal, ...local.journal]) {
    const prev = byId.get(entry.id);
    if (!prev) {
      byId.set(entry.id, entry);
      continue;
    }
    byId.set(entry.id, {
      ...prev,
      ...entry,
      attempts: Math.max(prev.attempts, entry.attempts),
      hintsUsed: Math.max(prev.hintsUsed, entry.hintsUsed),
      solutionConsulted: prev.solutionConsulted || entry.solutionConsulted,
      understood: prev.understood || entry.understood,
      reviewLater: prev.reviewLater || entry.reviewLater,
      at: prev.at > entry.at ? prev.at : entry.at,
    });
  }
  const journal = [...byId.values()].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 60);
  return { notions, journal };
}

export function recordReview(
  state: LearningState,
  seed: {
    languageId: string;
    lessonId: string;
    exerciseId?: string | null;
    title: string;
    chapter: number;
  },
  input: ReviewInput,
): LearningState {
  const id = `${seed.languageId}:${seed.lessonId}`;
  const current = state.notions[id] ?? emptyNotion(seed);
  const next = applyReview(current, input);
  return { ...state, notions: { ...state.notions, [id]: next } };
}

export function pushJournal(state: LearningState, entry: JournalEntry): LearningState {
  return { ...state, journal: upsertJournal(state.journal, entry) };
}

export function patchJournal(
  state: LearningState,
  id: string,
  patch: Partial<Pick<JournalEntry, "understood" | "reviewLater">>,
): LearningState {
  return {
    ...state,
    journal: state.journal.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
  };
}

export function dueNotions(state: LearningState, now = new Date()): NotionCard[] {
  return Object.values(state.notions)
    .filter((card) => isDue(card, now))
    .sort((a, b) => a.mastery - b.mastery || a.nextReviewAt.localeCompare(b.nextReviewAt));
}

export function revisitNotions(state: LearningState): NotionCard[] {
  return Object.values(state.notions)
    .filter((card) => isLowMastery(card))
    .sort((a, b) => a.mastery - b.mastery);
}

export function postponeNotion(state: LearningState, id: string): LearningState {
  const card = state.notions[id];
  if (!card) return state;
  const when = new Date();
  when.setDate(when.getDate() + 1);
  return {
    ...state,
    notions: {
      ...state.notions,
      [id]: { ...card, nextReviewAt: when.toISOString() },
    },
  };
}
