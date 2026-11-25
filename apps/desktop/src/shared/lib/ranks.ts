/**
 * Courbe exponentielle plus lente (raison 1,08, coût de base 200 XP).
 * Le niveau 2 coûte déjà ~4 leçons. Seuils indicatifs :
 * Fer 4 (~650), Or 10 (~2 500), Titane 28 (~17 500), Tungstène 52 (~124 000).
 *
 * Leçons + Q/R + succès d'un parcours complet arrivent au Titane.
 * Le Tungstène reste théorique : il faudrait un volume d'XP hors d'une pratique normale.
 */
export const RANKS = [
  { id: "bronze", name: "Bronze", minLevel: 1 },
  { id: "fer", name: "Fer", minLevel: 4 },
  { id: "argent", name: "Argent", minLevel: 7 },
  { id: "or", name: "Or", minLevel: 10 },
  { id: "platine", name: "Platine", minLevel: 13 },
  { id: "diamant", name: "Diamant", minLevel: 16 },
  { id: "emeraude", name: "Émeraude", minLevel: 19 },
  { id: "jade", name: "Jade", minLevel: 22 },
  { id: "perle", name: "Perle", minLevel: 24 },
  { id: "amethyste", name: "Améthyste", minLevel: 26 },
  { id: "titane", name: "Titane", minLevel: 28 },
  { id: "tungstene", name: "Tungstène", minLevel: 52 },
] as const;

export type RankId = (typeof RANKS)[number]["id"];

const GROWTH = 1.08;
const BASE_XP = 200;

export const LESSON_XP = 48;
export const QA_FIRST_XP = 24;

export function xpToReachLevel(level: number): number {
  if (level <= 1) return 0;
  const steps = level - 1;
  return Math.round((BASE_XP * (GROWTH ** steps - 1)) / (GROWTH - 1));
}

export function levelForXp(xp: number): number {
  const safe = Math.max(0, Math.floor(xp));
  let level = 1;
  while (level < 200 && xpToReachLevel(level + 1) <= safe) level += 1;
  return level;
}

export function rankForLevel(level: number) {
  let current: (typeof RANKS)[number] = RANKS[0];
  for (const rank of RANKS) {
    if (level >= rank.minLevel) current = rank;
  }
  return current;
}

export function rankById(id: string | null | undefined) {
  return RANKS.find((rank) => rank.id === id) ?? RANKS[0];
}

export function rankIndex(id: string): number {
  const index = RANKS.findIndex((rank) => rank.id === id);
  return index < 0 ? 0 : index;
}

export function nextRank(id: string) {
  const index = rankIndex(id);
  return RANKS[index + 1] ?? null;
}

/** Part de la barre entre le rang actuel et le suivant (1 au Tungstène). */
export function rankProgress(xp: number): { ratio: number; nextName: string | null } {
  const level = levelForXp(xp);
  const rank = rankForLevel(level);
  const next = nextRank(rank.id);
  if (!next) return { ratio: 1, nextName: null };
  const start = xpToReachLevel(rank.minLevel);
  const end = xpToReachLevel(next.minLevel);
  const span = Math.max(1, end - start);
  return {
    ratio: Math.max(0, Math.min(1, (xp - start) / span)),
    nextName: next.name,
  };
}

export function rankIcon(id: string): string {
  return `/ranks/${id}.png`;
}

/** XP d'une question maîtrisée `times` fois (1 = première fois, puis chute forte). */
export function xpForQaGrants(times: number): number {
  if (times <= 0) return 0;
  let xp = QA_FIRST_XP;
  for (let n = 1; n < times; n += 1) {
    xp += Math.max(1, Math.round(8 / n ** 1.25));
  }
  return xp;
}
