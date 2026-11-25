import type { RankId } from "@/shared/lib/ranks";

export type Rarity = "commun" | "rare" | "ardu";

export const RARITY_XP: Record<Rarity, number> = {
  commun: 35,
  rare: 100,
  ardu: 280,
};

export type AchCtx = {
  lessons: number;
  exercises: number;
  lessonTotal: number;
  exerciseTotal: number;
  byLang: Record<
    string,
    { started: boolean; complete: boolean; ch1: boolean; ch3: boolean }
  >;
  langsStarted: number;
  langsComplete: number;
  ch1: boolean;
  ch3: boolean;
  qaMastered: number;
  qaAttempts: number;
  qaLangDone: number;
  qaFast: boolean;
  qaFlash: boolean;
  qaPerfect: boolean;
  qaRepeat: boolean;
  hasAvatar: boolean;
  programs: number;
  programLangs: number;
  rankIndex: number;
  stats: {
    themes: string[];
    focus: boolean;
    tutorial: boolean;
    runsOk: number;
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
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  rarity: Rarity;
  test: (ctx: AchCtx) => boolean;
};

const started = (ctx: AchCtx, lang: string) => Boolean(ctx.byLang[lang]?.started);
const done = (ctx: AchCtx, lang: string) => Boolean(ctx.byLang[lang]?.complete);
const theme = (ctx: AchCtx, id: string) => ctx.stats.themes.includes(id);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "bienvenue", title: "Bienvenue", description: "Ouvrir CodeFlow avec un compte.", rarity: "commun", test: () => true },
  { id: "portrait", title: "Portrait", description: "Ajouter une photo de profil.", rarity: "commun", test: (c) => c.hasAvatar },
  { id: "theme-nuit", title: "Nuit", description: "Utiliser le thème Night.", rarity: "commun", test: (c) => theme(c, "dark") },
  { id: "theme-clair", title: "Clair de lune", description: "Activer le thème Clair.", rarity: "commun", test: (c) => theme(c, "light") },
  { id: "theme-prune", title: "Prune", description: "Activer le thème Prune.", rarity: "commun", test: (c) => theme(c, "prune") },
  { id: "theme-salade", title: "Salade", description: "Activer le thème Salade.", rarity: "commun", test: (c) => theme(c, "salad") },
  { id: "palette", title: "Collectionneur", description: "Essayer les quatre thèmes.", rarity: "ardu", test: (c) => ["dark", "light", "prune", "salad"].every((id) => theme(c, id)) },
  { id: "focus", title: "Concentration", description: "Activer le mode Focus.", rarity: "commun", test: (c) => c.stats.focus },
  { id: "guide", title: "Guide", description: "Terminer le tutoriel du compte.", rarity: "commun", test: (c) => c.stats.tutorial },
  { id: "premiere-lecon", title: "Première leçon", description: "Valider une leçon.", rarity: "commun", test: (c) => c.lessons >= 1 },
  { id: "lecons-10", title: "Rythme", description: "Valider 10 leçons.", rarity: "commun", test: (c) => c.lessons >= 10 },
  { id: "lecons-40", title: "Assidu", description: "Valider 40 leçons.", rarity: "rare", test: (c) => c.lessons >= 40 },
  { id: "lecons-100", title: "Marathon", description: "Valider 100 leçons.", rarity: "rare", test: (c) => c.lessons >= 100 },
  { id: "lecons-toutes", title: "Encyclopédie", description: "Valider toutes les leçons.", rarity: "ardu", test: (c) => c.lessonTotal > 0 && c.lessons >= c.lessonTotal },
  { id: "premier-exo", title: "Premier essai", description: "Réussir un exercice.", rarity: "commun", test: (c) => c.exercises >= 1 },
  { id: "exos-15", title: "Atelier", description: "Réussir 15 exercices.", rarity: "commun", test: (c) => c.exercises >= 15 },
  { id: "exos-50", title: "Artisan", description: "Réussir 50 exercices.", rarity: "rare", test: (c) => c.exercises >= 50 },
  { id: "exos-tous", title: "Maître d'atelier", description: "Réussir tous les exercices.", rarity: "ardu", test: (c) => c.exerciseTotal > 0 && c.exercises >= c.exerciseTotal },
  { id: "python-start", title: "Serpent", description: "Commencer le parcours Python.", rarity: "commun", test: (c) => started(c, "python") },
  { id: "csharp-start", title: "Dièse", description: "Commencer le parcours C#.", rarity: "commun", test: (c) => started(c, "csharp") },
  { id: "java-start", title: "Tasse", description: "Commencer le parcours Java.", rarity: "commun", test: (c) => started(c, "java") },
  { id: "cpp-start", title: "Chevrons", description: "Commencer le parcours C++.", rarity: "commun", test: (c) => started(c, "cpp") },
  { id: "polyglotte", title: "Polyglotte", description: "Commencer les quatre langages.", rarity: "rare", test: (c) => c.langsStarted >= 4 },
  { id: "python-fini", title: "Python complet", description: "Finir toutes les leçons Python.", rarity: "rare", test: (c) => done(c, "python") },
  { id: "csharp-fini", title: "C# complet", description: "Finir toutes les leçons C#.", rarity: "rare", test: (c) => done(c, "csharp") },
  { id: "java-fini", title: "Java complet", description: "Finir toutes les leçons Java.", rarity: "rare", test: (c) => done(c, "java") },
  { id: "cpp-fini", title: "C++ complet", description: "Finir toutes les leçons C++.", rarity: "rare", test: (c) => done(c, "cpp") },
  { id: "chapitre-1", title: "Chapitre un", description: "Terminer le chapitre 1 d'un langage.", rarity: "commun", test: (c) => c.ch1 },
  { id: "chapitre-3", title: "Horizon", description: "Terminer le chapitre 3 d'un langage.", rarity: "rare", test: (c) => c.ch3 },
  { id: "bonne-reponse", title: "Bonne réponse", description: "Maîtriser une question.", rarity: "commun", test: (c) => c.qaMastered >= 1 },
  { id: "qr-20", title: "Série", description: "Maîtriser 20 questions.", rarity: "commun", test: (c) => c.qaMastered >= 20 },
  { id: "qr-50", title: "Mémoire", description: "Maîtriser 50 questions.", rarity: "rare", test: (c) => c.qaMastered >= 50 },
  { id: "qr-langue", title: "Oral d'un langage", description: "Terminer les Q/R d'un langage.", rarity: "rare", test: (c) => c.qaLangDone >= 1 },
  { id: "qr-toutes", title: "Grand oral", description: "Terminer les Q/R des quatre langages.", rarity: "ardu", test: (c) => c.qaLangDone >= 4 },
  { id: "qr-rapide", title: "Contre-la-montre", description: "Finir une série Q/R en moins de 12 secondes par question.", rarity: "rare", test: (c) => c.qaFast },
  { id: "qr-eclair", title: "Éclair", description: "Finir une série Q/R en moins de 8 secondes par question.", rarity: "ardu", test: (c) => c.qaFlash },
  { id: "qr-parfait", title: "Sans faute", description: "Finir une série Q/R sans erreur.", rarity: "rare", test: (c) => c.qaPerfect },
  { id: "qr-essais", title: "Persévérance", description: "Cumuler 30 tentatives aux Q/R.", rarity: "commun", test: (c) => c.qaAttempts >= 30 },
  { id: "qr-repet", title: "Révision", description: "Réussir à nouveau une question déjà maîtrisée.", rarity: "commun", test: (c) => c.qaRepeat },
  { id: "qr-cent", title: "Endurance", description: "Cumuler 100 tentatives aux Q/R.", rarity: "rare", test: (c) => c.qaAttempts >= 100 },
  { id: "demande", title: "Main tendue", description: "Envoyer une demande d'ami.", rarity: "commun", test: (c) => c.stats.requestsSent >= 1 },
  { id: "ami", title: "Premier ami", description: "Avoir un ami accepté.", rarity: "rare", test: (c) => c.stats.friendPeak >= 1 },
  { id: "amis-3", title: "Cercle", description: "Avoir 3 amis.", rarity: "rare", test: (c) => c.stats.friendPeak >= 3 },
  { id: "amis-5", title: "Communauté", description: "Avoir 5 amis.", rarity: "ardu", test: (c) => c.stats.friendPeak >= 5 },
  { id: "message", title: "Mot", description: "Envoyer un message à un ami.", rarity: "commun", test: (c) => c.stats.messagesSent >= 1 },
  { id: "messages-15", title: "Correspondant", description: "Envoyer 15 messages.", rarity: "commun", test: (c) => c.stats.messagesSent >= 15 },
  { id: "messages-40", title: "Plume", description: "Envoyer 40 messages.", rarity: "rare", test: (c) => c.stats.messagesSent >= 40 },
  { id: "reaction", title: "Réaction", description: "Réagir à un message.", rarity: "commun", test: (c) => c.stats.reactions >= 1 },
  { id: "efface", title: "Rétractation", description: "Supprimer un message pas encore lu.", rarity: "rare", test: (c) => c.stats.deletedUnread },
  { id: "accepte", title: "Accueil", description: "Accepter une demande d'ami.", rarity: "commun", test: (c) => c.stats.accepts >= 1 },
  { id: "refuse", title: "Limite", description: "Refuser une demande d'ami.", rarity: "commun", test: (c) => c.stats.refuses >= 1 },
  { id: "vu", title: "Accusé", description: "Lire un message reçu.", rarity: "commun", test: (c) => c.stats.reads >= 1 },
  { id: "emoji", title: "Émoji", description: "Envoyer un message qui contient un émoji.", rarity: "commun", test: (c) => c.stats.emojiSent },
  { id: "carnet", title: "Carnet", description: "Enregistrer un programme.", rarity: "commun", test: (c) => c.programs >= 1 },
  { id: "carnet-5", title: "Archives", description: "Enregistrer 5 programmes.", rarity: "rare", test: (c) => c.programs >= 5 },
  { id: "carnet-langages", title: "Deux plumes", description: "Enregistrer des programmes dans deux langages.", rarity: "rare", test: (c) => c.programLangs >= 2 },
  { id: "execution", title: "Ça tourne", description: "Exécuter un programme avec succès.", rarity: "commun", test: (c) => c.stats.runsOk >= 1 },
  { id: "executions-10", title: "Banc d'essai", description: "Réussir 10 exécutions.", rarity: "commun", test: (c) => c.stats.runsOk >= 10 },
  { id: "executions-40", title: "Répétition", description: "Réussir 40 exécutions.", rarity: "rare", test: (c) => c.stats.runsOk >= 40 },
  { id: "debug", title: "Débogage", description: "Réussir une exécution après un échec.", rarity: "rare", test: (c) => c.stats.recovered },
  { id: "assistance", title: "Coup de pouce", description: "Demander l'aide d'un exercice.", rarity: "commun", test: (c) => c.stats.assist },
  { id: "objectif", title: "Objectif du jour", description: "Atteindre l'objectif quotidien.", rarity: "commun", test: (c) => c.stats.goalMet },
  { id: "ambitieux", title: "Ambitieux", description: "Régler l'objectif du jour à 5 ou plus.", rarity: "rare", test: (c) => c.stats.goalAmbitious },
  { id: "retour", title: "Retour", description: "Utiliser CodeFlow sur deux jours différents.", rarity: "commun", test: (c) => c.stats.activeDays.length >= 2 },
  { id: "semaine", title: "Semaine", description: "Avoir une activité sur 5 jours.", rarity: "rare", test: (c) => c.stats.activeDays.length >= 5 },
  { id: "classement", title: "Curieux", description: "Consulter le classement.", rarity: "commun", test: (c) => c.stats.leaderboard },
  { id: "visiteur", title: "Visiteur", description: "Ouvrir le profil d'un autre apprenant.", rarity: "commun", test: (c) => c.stats.visitedProfile },
  { id: "rang-fer", title: "Rang Fer", description: "Atteindre le rang Fer.", rarity: "commun", test: (c) => c.rankIndex >= 1 },
  { id: "rang-or", title: "Rang Or", description: "Atteindre le rang Or.", rarity: "rare", test: (c) => c.rankIndex >= 3 },
  { id: "rang-diamant", title: "Rang Diamant", description: "Atteindre le rang Diamant.", rarity: "ardu", test: (c) => c.rankIndex >= 5 },
  { id: "rang-titane", title: "Rang Titane", description: "Atteindre le rang Titane.", rarity: "ardu", test: (c) => c.rankIndex >= 10 },
];

if (ACHIEVEMENTS.length !== 71) {
  throw new Error(`CodeFlow attend 71 succès, pas ${ACHIEVEMENTS.length}.`);
}

const ids = new Set<string>();
for (const item of ACHIEVEMENTS) {
  if (ids.has(item.id)) throw new Error(`Succès en double : ${item.id}`);
  ids.add(item.id);
}

export function achievementIcon(id: string): string {
  return `/achievements/${id}.png`;
}

export function rarityLabel(rarity: Rarity): string {
  if (rarity === "rare") return "Rare";
  if (rarity === "ardu") return "Ardu";
  return "Commun";
}

export function rarityBorder(rarity: Rarity): string {
  if (rarity === "rare") return "#e85d6a";
  if (rarity === "ardu") return "#a78bfa";
  return "#4f8cff";
}

const UNLOCK_HINTS: Record<string, string> = {
  bienvenue: "Ouvrez CodeFlow.",
  portrait: "Ajoutez une photo.",
  "theme-nuit": "Passez en thème Nuit.",
  "theme-clair": "Passez en thème Clair.",
  "theme-prune": "Passez en thème Prune.",
  "theme-salade": "Passez en thème Salade.",
  palette: "Essayez les quatre thèmes.",
  focus: "Activez le mode Focus.",
  guide: "Terminez le tutoriel.",
  "premiere-lecon": "Validez une leçon.",
  "lecons-10": "Validez 10 leçons.",
  "lecons-40": "Validez 40 leçons.",
  "lecons-100": "Validez 100 leçons.",
  "lecons-toutes": "Validez toutes les leçons.",
  "premier-exo": "Réussissez un exercice.",
  "exos-15": "Réussissez 15 exercices.",
  "exos-50": "Réussissez 50 exercices.",
  "exos-tous": "Réussissez tous les exercices.",
  "python-start": "Commencez Python.",
  "csharp-start": "Commencez C#.",
  "java-start": "Commencez Java.",
  "cpp-start": "Commencez C++.",
  polyglotte: "Commencez les quatre langages.",
  "python-fini": "Finissez Python.",
  "csharp-fini": "Finissez C#.",
  "java-fini": "Finissez Java.",
  "cpp-fini": "Finissez C++.",
  "chapitre-1": "Finissez un chapitre 1.",
  "chapitre-3": "Finissez un chapitre 3.",
  "bonne-reponse": "Maîtrisez une question.",
  "qr-20": "Maîtrisez 20 questions.",
  "qr-50": "Maîtrisez 50 questions.",
  "qr-langue": "Finissez les Q/R d'un langage.",
  "qr-toutes": "Finissez toutes les Q/R.",
  "qr-rapide": "Q/R en moins de 12 s.",
  "qr-eclair": "Q/R en moins de 8 s.",
  "qr-parfait": "Une série Q/R sans faute.",
  "qr-essais": "Tentez 30 questions.",
  "qr-repet": "Révisez une question connue.",
  "qr-cent": "Tentez 100 questions.",
  demande: "Envoyez une demande d'ami.",
  ami: "Ayez un ami.",
  "amis-3": "Ayez 3 amis.",
  "amis-5": "Ayez 5 amis.",
  message: "Écrivez à un ami.",
  "messages-15": "Envoyez 15 messages.",
  "messages-40": "Envoyez 40 messages.",
  reaction: "Réagissez à un message.",
  efface: "Supprimez un message non lu.",
  accepte: "Acceptez une demande.",
  refuse: "Refusez une demande.",
  vu: "Lisez un message reçu.",
  emoji: "Envoyez un émoji.",
  carnet: "Enregistrez un programme.",
  "carnet-5": "Enregistrez 5 programmes.",
  "carnet-langages": "Deux langages au carnet.",
  execution: "Exécutez un programme.",
  "executions-10": "Réussissez 10 exécutions.",
  "executions-40": "Réussissez 40 exécutions.",
  debug: "Réussissez après un échec.",
  assistance: "Demandez l'aide d'un exercice.",
  objectif: "Atteignez l'objectif du jour.",
  ambitieux: "Objectif du jour à 5 ou plus.",
  retour: "Revenez un autre jour.",
  semaine: "Soyez actif 5 jours.",
  classement: "Ouvrez le classement.",
  visiteur: "Visitez un autre profil.",
  "rang-fer": "Atteignez le rang Fer.",
  "rang-or": "Atteignez le rang Or.",
  "rang-diamant": "Atteignez le rang Diamant.",
  "rang-titane": "Atteignez le rang Titane.",
};

export function unlockHint(item: Achievement): string {
  return UNLOCK_HINTS[item.id] ?? item.description;
}

for (const item of ACHIEVEMENTS) {
  if (!UNLOCK_HINTS[item.id]) throw new Error(`Indice manquant : ${item.id}`);
}

export type { RankId };
