import {
  ACHIEVEMENTS,
  RARITY_XP,
  type AchCtx,
} from "@/shared/lib/achievements";
import {
  countLessons,
  getAllLessons,
  getQuiz,
  isChapterComplete,
  languages,
} from "@/shared/lib/content";
import {
  LESSON_XP,
  levelForXp,
  rankForLevel,
  rankIndex,
  xpForQaGrants,
} from "@/shared/lib/ranks";
import { emptyLearning, mergeLearning, normalizeLearning, type LearningState } from "@/shared/lib/learning";
import type { ProgressSnapshot } from "@/shared/lib/tauri";

export type UsageStats = {
  themes: string[];
  focus: boolean;
  tutorial: boolean;
  runsOk: number;
  runsFail: number;
  recovered: boolean;
  assist: boolean;
  messagesSent: number;
  emojiSent: boolean;
  reactions: number;
  requestsSent: number;
  accepts: number;
  refuses: number;
  deletedUnread: boolean;
  reads: number;
  friendPeak: number;
  leaderboard: boolean;
  visitedProfile: boolean;
  goalMet: boolean;
  goalAmbitious: boolean;
  activeDays: string[];
};

/** Leçons, exercices, Q/R et succès déjà comptés au moment d'un reset admin. */
export type CreditFloor = {
  lessons: string[];
  exercises: string[];
  qaKeys: string[];
  achievementIds: string[];
};

export type ProgressionDoc = {
  tutorialDone: boolean;
  claimedLessons: string[];
  qaGrants: Record<string, number>;
  qaSeenAttempts: Record<string, number>;
  achievements: string[];
  stats: UsageStats;
  xp: number;
  level: number;
  rankId: string;
  rankName: string;
  updatedAt: string;
  resetAt: string;
  creditFloor?: CreditFloor;
  learning: LearningState;
};

export type StatPatch = {
  focus?: boolean;
  tutorial?: boolean;
  runsOk?: number;
  runsFail?: number;
  recovered?: boolean;
  assist?: boolean;
  messagesSent?: number;
  emojiSent?: boolean;
  reactions?: number;
  requestsSent?: number;
  accepts?: number;
  refuses?: number;
  deletedUnread?: boolean;
  reads?: number;
  leaderboard?: boolean;
  visitedProfile?: boolean;
  theme?: string;
  friendPeak?: number;
};

export function emptyStats(): UsageStats {
  return {
    themes: [],
    focus: false,
    tutorial: false,
    runsOk: 0,
    runsFail: 0,
    recovered: false,
    assist: false,
    messagesSent: 0,
    emojiSent: false,
    reactions: 0,
    requestsSent: 0,
    accepts: 0,
    refuses: 0,
    deletedUnread: false,
    reads: 0,
    friendPeak: 0,
    leaderboard: false,
    visitedProfile: false,
    goalMet: false,
    goalAmbitious: false,
    activeDays: [],
  };
}

export function emptyProgression(): ProgressionDoc {
  return {
    tutorialDone: false,
    claimedLessons: [],
    qaGrants: {},
    qaSeenAttempts: {},
    achievements: [],
    stats: emptyStats(),
    xp: 0,
    level: 1,
    rankId: "bronze",
    rankName: "Bronze",
    updatedAt: "",
    resetAt: "",
    learning: emptyLearning(),
  };
}

function readFloor(raw: unknown): CreditFloor | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const floor: CreditFloor = {
    lessons: asStringArray(data.lessons),
    exercises: asStringArray(data.exercises),
    qaKeys: asStringArray(data.qaKeys),
    achievementIds: asStringArray(data.achievementIds),
  };
  if (
    floor.lessons.length === 0 &&
    floor.exercises.length === 0 &&
    floor.qaKeys.length === 0 &&
    floor.achievementIds.length === 0
  ) {
    return undefined;
  }
  return floor;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n);
  }
  return out;
}

export function normalizeProgression(raw: unknown): ProgressionDoc {
  const base = emptyProgression();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const statsRaw = (data.stats && typeof data.stats === "object" ? data.stats : {}) as Record<string, unknown>;
  const stats = emptyStats();
  stats.themes = asStringArray(statsRaw.themes);
  stats.activeDays = asStringArray(statsRaw.activeDays).slice(-40);
  stats.focus = Boolean(statsRaw.focus);
  stats.tutorial = Boolean(statsRaw.tutorial);
  stats.runsOk = Number(statsRaw.runsOk) || 0;
  stats.runsFail = Number(statsRaw.runsFail) || 0;
  stats.recovered = Boolean(statsRaw.recovered);
  stats.assist = Boolean(statsRaw.assist);
  stats.messagesSent = Number(statsRaw.messagesSent) || 0;
  stats.emojiSent = Boolean(statsRaw.emojiSent);
  stats.reactions = Number(statsRaw.reactions) || 0;
  stats.requestsSent = Number(statsRaw.requestsSent) || 0;
  stats.accepts = Number(statsRaw.accepts) || 0;
  stats.refuses = Number(statsRaw.refuses) || 0;
  stats.deletedUnread = Boolean(statsRaw.deletedUnread);
  stats.reads = Number(statsRaw.reads) || 0;
  stats.friendPeak = Number(statsRaw.friendPeak) || 0;
  stats.leaderboard = Boolean(statsRaw.leaderboard);
  stats.visitedProfile = Boolean(statsRaw.visitedProfile);
  stats.goalMet = Boolean(statsRaw.goalMet);
  stats.goalAmbitious = Boolean(statsRaw.goalAmbitious);
  return {
    ...base,
    tutorialDone: Boolean(data.tutorialDone) || stats.tutorial,
    claimedLessons: asStringArray(data.claimedLessons),
    qaGrants: asNumberMap(data.qaGrants),
    qaSeenAttempts: asNumberMap(data.qaSeenAttempts),
    achievements: asStringArray(data.achievements),
    stats,
    xp: Number(data.xp) || 0,
    level: Number(data.level) || 1,
    rankId: typeof data.rankId === "string" ? data.rankId : "bronze",
    rankName: typeof data.rankName === "string" ? data.rankName : "Bronze",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
    resetAt: typeof data.resetAt === "string" ? data.resetAt : "",
    creditFloor: readFloor(data.creditFloor),
    learning: normalizeLearning(data.learning),
  };
}

export function applyStatPatch(doc: ProgressionDoc, patch: StatPatch): ProgressionDoc {
  const stats = { ...doc.stats, themes: [...doc.stats.themes], activeDays: [...doc.stats.activeDays] };
  if (patch.focus) stats.focus = true;
  if (patch.tutorial) stats.tutorial = true;
  if (patch.recovered) stats.recovered = true;
  if (patch.assist) stats.assist = true;
  if (patch.emojiSent) stats.emojiSent = true;
  if (patch.deletedUnread) stats.deletedUnread = true;
  if (patch.leaderboard) stats.leaderboard = true;
  if (patch.visitedProfile) stats.visitedProfile = true;
  if (patch.runsOk) stats.runsOk += patch.runsOk;
  if (patch.runsFail) stats.runsFail += patch.runsFail;
  if (patch.messagesSent) stats.messagesSent += patch.messagesSent;
  if (patch.reactions) stats.reactions += patch.reactions;
  if (patch.requestsSent) stats.requestsSent += patch.requestsSent;
  if (patch.accepts) stats.accepts += patch.accepts;
  if (patch.refuses) stats.refuses += patch.refuses;
  if (patch.reads) stats.reads += patch.reads;
  if (patch.friendPeak) stats.friendPeak = Math.max(stats.friendPeak, patch.friendPeak);
  if (patch.theme && !stats.themes.includes(patch.theme)) stats.themes.push(patch.theme);
  if (patch.runsOk && stats.runsFail > 0) stats.recovered = true;
  return { ...doc, stats, tutorialDone: doc.tutorialDone || stats.tutorial };
}

function union(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export function mergeProgression(local: ProgressionDoc, remote: ProgressionDoc): ProgressionDoc {
  const localReset = local.resetAt || "";
  const remoteReset = remote.resetAt || "";
  if (localReset !== remoteReset) {
    const winner = localReset > remoteReset ? local : remote;
    const other = winner === local ? remote : local;
    return {
      ...winner,
      tutorialDone: winner.tutorialDone || other.tutorialDone,
      learning: mergeLearning(winner.learning ?? emptyLearning(), other.learning ?? emptyLearning()),
    };
  }
  const stats = emptyStats();
  stats.themes = union(local.stats.themes, remote.stats.themes);
  stats.activeDays = union(local.stats.activeDays, remote.stats.activeDays).slice(-40);
  stats.focus = local.stats.focus || remote.stats.focus;
  stats.tutorial = local.stats.tutorial || remote.stats.tutorial;
  stats.recovered = local.stats.recovered || remote.stats.recovered;
  stats.assist = local.stats.assist || remote.stats.assist;
  stats.emojiSent = local.stats.emojiSent || remote.stats.emojiSent;
  stats.deletedUnread = local.stats.deletedUnread || remote.stats.deletedUnread;
  stats.leaderboard = local.stats.leaderboard || remote.stats.leaderboard;
  stats.visitedProfile = local.stats.visitedProfile || remote.stats.visitedProfile;
  stats.goalMet = local.stats.goalMet || remote.stats.goalMet;
  stats.goalAmbitious = local.stats.goalAmbitious || remote.stats.goalAmbitious;
  stats.runsOk = Math.max(local.stats.runsOk, remote.stats.runsOk);
  stats.runsFail = Math.max(local.stats.runsFail, remote.stats.runsFail);
  stats.messagesSent = Math.max(local.stats.messagesSent, remote.stats.messagesSent);
  stats.reactions = Math.max(local.stats.reactions, remote.stats.reactions);
  stats.requestsSent = Math.max(local.stats.requestsSent, remote.stats.requestsSent);
  stats.accepts = Math.max(local.stats.accepts, remote.stats.accepts);
  stats.refuses = Math.max(local.stats.refuses, remote.stats.refuses);
  stats.reads = Math.max(local.stats.reads, remote.stats.reads);
  stats.friendPeak = Math.max(local.stats.friendPeak, remote.stats.friendPeak);
  const qaGrants: Record<string, number> = { ...local.qaGrants };
  for (const [key, value] of Object.entries(remote.qaGrants)) {
    qaGrants[key] = Math.max(qaGrants[key] ?? 0, value);
  }
  const qaSeenAttempts: Record<string, number> = { ...local.qaSeenAttempts };
  for (const [key, value] of Object.entries(remote.qaSeenAttempts)) {
    qaSeenAttempts[key] = Math.max(qaSeenAttempts[key] ?? 0, value);
  }
  const newer = (remote.updatedAt || "") >= (local.updatedAt || "") ? remote : local;
  return {
    ...newer,
    tutorialDone: local.tutorialDone || remote.tutorialDone || stats.tutorial,
    claimedLessons: union(local.claimedLessons, remote.claimedLessons),
    achievements: union(local.achievements, remote.achievements),
    qaGrants,
    qaSeenAttempts,
    stats,
    resetAt: localReset,
    creditFloor: newer.creditFloor ?? local.creditFloor ?? remote.creditFloor,
    learning: mergeLearning(local.learning ?? emptyLearning(), remote.learning ?? emptyLearning()),
  };
}

function exerciseTotal(): number {
  return languages.reduce((sum, language) => {
    return sum + getAllLessons(language.id).filter((lesson) => lesson.exercise).length;
  }, 0);
}

export function absorbActivity(
  doc: ProgressionDoc,
  progress: ProgressSnapshot,
  extras: { friendCount: number; hasAvatar: boolean; programCount: number; programLangs: number },
): ProgressionDoc {
  const stats = {
    ...doc.stats,
    themes: [...doc.stats.themes],
    activeDays: [...doc.stats.activeDays],
  };
  if (progress.theme && !stats.themes.includes(progress.theme)) stats.themes.push(progress.theme);
  const today = new Date().toISOString().slice(0, 10);
  if (!stats.activeDays.includes(today)) stats.activeDays.push(today);
  for (const entry of progress.history ?? []) {
    const day = (entry.at || "").slice(0, 10);
    if (day && !stats.activeDays.includes(day)) stats.activeDays.push(day);
  }
  stats.activeDays = stats.activeDays.slice(-40);
  if ((progress.dailyGoal ?? 0) >= 5) stats.goalAmbitious = true;
  if ((progress.dailyCount ?? 0) > 0 && progress.dailyCount >= (progress.dailyGoal ?? 1)) {
    stats.goalMet = true;
  }
  stats.friendPeak = Math.max(stats.friendPeak, extras.friendCount);
  stats.tutorial = stats.tutorial || doc.tutorialDone;

  const floorLessons = new Set(doc.creditFloor?.lessons ?? []);
  const floorQa = new Set(doc.creditFloor?.qaKeys ?? []);
  const claimed = new Set([...doc.claimedLessons].filter((id) => !floorLessons.has(id)));
  for (const id of progress.completedLessons) {
    if (!floorLessons.has(id)) claimed.add(id);
  }

  const qaGrants = { ...doc.qaGrants };
  for (const key of floorQa) delete qaGrants[key];
  const qaSeenAttempts = { ...doc.qaSeenAttempts };
  for (const language of languages) {
    const qa = progress.qa?.[language.id];
    if (!qa) continue;
    const seen = qaSeenAttempts[language.id];
    const known = seen != null;
    for (const id of qa.correctIds) {
      const key = `${language.id}:${id}`;
      if (floorQa.has(key)) continue;
      if (!qaGrants[key]) qaGrants[key] = 1;
    }
    if (!known) {
      qaSeenAttempts[language.id] = qa.correctAttempts;
      continue;
    }
    const delta = Math.max(0, qa.correctAttempts - seen);
    const fresh = qa.correctIds.filter((id) => (doc.qaGrants[`${language.id}:${id}`] ?? 0) < 1).length;
    const repeats = Math.max(0, delta - fresh);
    if (repeats > 0 && qa.correctIds.length > 0) {
      const key = `${language.id}:${qa.correctIds[qa.correctIds.length - 1]}`;
      qaGrants[key] = (qaGrants[key] ?? 1) + repeats;
    }
    qaSeenAttempts[language.id] = qa.correctAttempts;
  }

  return {
    ...doc,
    claimedLessons: [...claimed],
    qaGrants,
    qaSeenAttempts,
    stats,
  };
}

function buildCtx(
  doc: ProgressionDoc,
  progress: ProgressSnapshot,
  extras: { hasAvatar: boolean; programCount: number; programLangs: number },
  rankIdx: number,
): AchCtx {
  const byLang: AchCtx["byLang"] = {};
  let langsStarted = 0;
  let langsComplete = 0;
  let ch1 = false;
  let ch3 = false;
  for (const language of languages) {
    const lessons = getAllLessons(language.id);
    const ids = new Set(lessons.map((lesson) => lesson.id));
    const doneCount = progress.completedLessons.filter((id) => ids.has(id)).length;
    const started = doneCount > 0;
    const complete = lessons.length > 0 && doneCount >= lessons.length;
    const chapter1 = isChapterComplete(language.id, 1, progress.completedLessons);
    const chapter3 = isChapterComplete(language.id, 3, progress.completedLessons);
    if (started) langsStarted += 1;
    if (complete) langsComplete += 1;
    if (chapter1) ch1 = true;
    if (chapter3) ch3 = true;
    byLang[language.id] = { started, complete, ch1: chapter1, ch3: chapter3 };
  }
  let qaMastered = 0;
  let qaAttempts = 0;
  let qaLangDone = 0;
  let qaFast = false;
  let qaFlash = false;
  let qaPerfect = false;
  for (const language of languages) {
    const quiz = getQuiz(language.id);
    const qa = progress.qa?.[language.id];
    if (!quiz || !qa) continue;
    qaMastered += qa.correctIds.length;
    qaAttempts += qa.attempts;
    const pool = quiz.questions.length;
    if (pool > 0 && qa.correctIds.length >= pool) {
      qaLangDone += 1;
      const ms = qa.completionMs ?? qa.timeSpentMs;
      if (ms > 0 && ms <= pool * 12_000) qaFast = true;
      if (ms > 0 && ms <= pool * 8_000) qaFlash = true;
      if (qa.attempts > 0 && qa.correctAttempts >= qa.attempts && (qa.failedIds?.length ?? 0) === 0) {
        qaPerfect = true;
      }
    }
  }
  const lessonIds = new Set(languages.flatMap((language) => getAllLessons(language.id).map((lesson) => lesson.id)));
  const lessons = progress.completedLessons.filter((id) => lessonIds.has(id)).length;
  const exerciseIds = new Set(
    languages.flatMap((language) =>
      getAllLessons(language.id)
        .map((lesson) => lesson.exercise?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const exercises = progress.completedExercises.filter((id) => exerciseIds.has(id)).length;
  return {
    lessons,
    exercises,
    lessonTotal: countLessons(),
    exerciseTotal: exerciseTotal(),
    byLang,
    langsStarted,
    langsComplete,
    ch1,
    ch3,
    qaMastered,
    qaAttempts,
    qaLangDone,
    qaFast,
    qaFlash,
    qaPerfect,
    qaRepeat: Object.values(doc.qaGrants).some((times) => times > 1),
    hasAvatar: extras.hasAvatar,
    programs: extras.programCount,
    programLangs: extras.programLangs,
    rankIndex: rankIdx,
    stats: doc.stats,
  };
}

function xpFrom(doc: ProgressionDoc): number {
  let xp = doc.claimedLessons.length * LESSON_XP;
  for (const times of Object.values(doc.qaGrants)) xp += xpForQaGrants(times);
  for (const id of doc.achievements) {
    const item = ACHIEVEMENTS.find((achievement) => achievement.id === id);
    if (item) xp += RARITY_XP[item.rarity];
  }
  return xp;
}

export function evaluateProgression(doc: ProgressionDoc, progress: ProgressSnapshot, extras: {
  hasAvatar: boolean;
  programCount: number;
  programLangs: number;
}): ProgressionDoc {
  let achievements = new Set(doc.achievements);
  let suppressed = new Set(doc.creditFloor?.achievementIds ?? []);
  for (const id of suppressed) achievements.delete(id);
  let xp = 0;
  let level = 1;
  let rank = rankForLevel(1);
  for (let pass = 0; pass < 4; pass += 1) {
    const ctx = buildCtx({ ...doc, achievements: [...achievements] }, progress, extras, rankIndex(rank.id));
    const still = new Set<string>();
    for (const item of ACHIEVEMENTS) {
      const passed = item.test(ctx);
      if (suppressed.has(item.id) && passed) {
        still.add(item.id);
        continue;
      }
      if (passed) achievements.add(item.id);
    }
    suppressed = still;
    const next = { ...doc, achievements: [...achievements] };
    xp = xpFrom(next);
    level = levelForXp(xp);
    rank = rankForLevel(level);
  }
  const creditFloor = doc.creditFloor
    ? { ...doc.creditFloor, achievementIds: [...suppressed] }
    : undefined;
  return {
    ...doc,
    achievements: [...achievements],
    creditFloor,
    xp,
    level,
    rankId: rank.id,
    rankName: rank.name,
    tutorialDone: doc.tutorialDone || doc.stats.tutorial,
    updatedAt: new Date().toISOString(),
  };
}

export function progressionSignature(doc: ProgressionDoc): string {
  const { updatedAt: _ignored, ...rest } = doc;
  return JSON.stringify(rest);
}
