/** Répétition espacée. Une seule réussite ne vaut pas la maîtrise. */

export type NotionCard = {
  id: string;
  languageId: string;
  lessonId: string;
  exerciseId: string | null;
  title: string;
  chapter: number;
  successes: number;
  failures: number;
  hintsUsed: number;
  solutionsSeen: number;
  ease: number;
  intervalDays: number;
  mastery: number;
  lastReviewAt: string | null;
  nextReviewAt: string;
  lapses: number;
};

export type ReviewInput = {
  passed: boolean;
  hints: number;
  solution: boolean;
  attempts: number;
};

export function notionId(languageId: string, lessonId: string): string {
  return `${languageId}:${lessonId}`;
}

export function emptyNotion(input: {
  languageId: string;
  lessonId: string;
  exerciseId?: string | null;
  title: string;
  chapter: number;
}): NotionCard {
  return {
    id: notionId(input.languageId, input.lessonId),
    languageId: input.languageId,
    lessonId: input.lessonId,
    exerciseId: input.exerciseId ?? null,
    title: input.title,
    chapter: input.chapter,
    successes: 0,
    failures: 0,
    hintsUsed: 0,
    solutionsSeen: 0,
    ease: 2.5,
    intervalDays: 0,
    mastery: 0,
    lastReviewAt: null,
    nextReviewAt: new Date().toISOString(),
    lapses: 0,
  };
}

/** 0 à 100. Un succès propre vaut 22, pas 100. */
export function masteryScore(card: Pick<
  NotionCard,
  "successes" | "failures" | "hintsUsed" | "solutionsSeen"
>): number {
  const raw =
    22 * card.successes -
    16 * card.failures -
    10 * card.solutionsSeen -
    4 * Math.min(card.hintsUsed, 8);
  return Math.max(0, Math.min(100, raw));
}

/** Qualité SM-2 (0–5). En dessous de 3, l'intervalle repart à 1 jour. */
export function reviewQuality(input: ReviewInput): number {
  if (!input.passed) {
    if (input.solution) return 1;
    if (input.hints > 0) return 2;
    return 2;
  }
  if (input.solution) return 3;
  if (input.hints > 0 || input.attempts > 3) return 4;
  if (input.attempts > 1) return 4;
  return 5;
}

function addDays(iso: string, days: number): string {
  const when = new Date(iso);
  when.setTime(when.getTime() + days * 24 * 60 * 60 * 1000);
  return when.toISOString();
}

export function applyReview(card: NotionCard, input: ReviewInput, now = new Date()): NotionCard {
  const quality = reviewQuality(input);
  let ease = card.ease;
  let interval = card.intervalDays;
  let lapses = card.lapses;
  const successes = card.successes + (input.passed ? 1 : 0);
  const failures = card.failures + (input.passed ? 0 : 1);

  if (quality < 3) {
    interval = 1;
    lapses += 1;
    ease = Math.max(1.3, round2(ease - 0.2));
  } else if (successes <= 1) {
    interval = 1;
    ease = adjustEase(ease, quality);
  } else if (successes === 2) {
    interval = 3;
    ease = adjustEase(ease, quality);
  } else {
    interval = Math.max(1, Math.round(Math.max(interval, 1) * ease));
    ease = adjustEase(ease, quality);
  }

  const next: NotionCard = {
    ...card,
    successes,
    failures,
    hintsUsed: card.hintsUsed + Math.max(0, input.hints),
    solutionsSeen: card.solutionsSeen + (input.solution ? 1 : 0),
    ease,
    intervalDays: interval,
    lapses,
    lastReviewAt: now.toISOString(),
    nextReviewAt: now.toISOString(),
    mastery: 0,
  };
  next.mastery = masteryScore(next);
  const delay = quality < 3 ? 0 : interval;
  next.nextReviewAt = delay <= 0 ? now.toISOString() : addDays(now.toISOString(), delay);
  return next;
}

function adjustEase(ease: number, quality: number): number {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return Math.max(1.3, round2(ease + delta));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isDue(card: NotionCard, now = new Date()): boolean {
  return Date.parse(card.nextReviewAt) <= now.getTime();
}

export function isLowMastery(card: NotionCard): boolean {
  return card.mastery < 70 && (card.failures > 0 || card.solutionsSeen > 0 || card.successes < 3);
}
