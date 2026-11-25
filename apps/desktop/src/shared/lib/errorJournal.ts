export type ErrorKind =
  | "syntax"
  | "undefined"
  | "type"
  | "condition"
  | "loop"
  | "function"
  | "logic"
  | "result"
  | "runtime"
  | "misunderstanding";

export type JournalEntry = {
  id: string;
  languageId: string;
  lessonId: string;
  lessonTitle: string;
  chapter: number;
  exerciseId: string;
  at: string;
  kind: ErrorKind;
  message: string;
  expected: string;
  got: string;
  attempts: number;
  hintsUsed: number;
  solutionConsulted: boolean;
  understood: boolean;
  reviewLater: boolean;
};

export type ErrorExplanation = {
  kind: ErrorKind;
  label: string;
  what: string;
  why: string;
  fix: string;
  avoid: string;
};

const LABELS: Record<ErrorKind, string> = {
  syntax: "Syntaxe",
  undefined: "Nom inconnu",
  type: "Type",
  condition: "Condition",
  loop: "Boucle",
  function: "Fonction",
  logic: "Logique",
  result: "Résultat",
  runtime: "Exécution",
  misunderstanding: "Consigne",
};

export function errorLabel(kind: ErrorKind): string {
  return LABELS[kind];
}

export function classifyError(input: {
  stderr: string;
  expected: string;
  got: string;
  outputMatched: boolean;
  structureRejected: boolean;
}): ErrorKind {
  const text = input.stderr.toLowerCase();
  if (input.structureRejected && input.outputMatched) return "logic";
  if (input.structureRejected) return "misunderstanding";
  if (/syntaxerror|syntaxe|expected ';|point-virgule|indentationerror|cs1002|cs1513|error: expected/.test(text)) {
    return "syntax";
  }
  if (/nameerror|not defined|introuvable|cannot find symbol|undeclared|cs0103|identifiant/.test(text)) {
    return "undefined";
  }
  if (/typeerror|type mismatch|cannot convert|incompatible|cs0029|invalid conversion/.test(text)) {
    return "type";
  }
  if (/zerodivision|indexerror|index out|keyerror|nullreference|nullpointer|segmentation|overflow|timeout|délai/.test(text)) {
    return "runtime";
  }
  if (/while|for |boucle|range\(/.test(text) && /erreur|error/.test(text)) return "loop";
  if (input.outputMatched === false && input.got.trim() && !/error|erreur|exception/.test(text)) {
    return "result";
  }
  if (/if |else |condition/.test(text)) return "condition";
  if (/def |fonction|function|return/.test(text) && /error|erreur/.test(text)) return "function";
  if (/error|erreur|exception|échec/.test(text)) return "runtime";
  if (!input.outputMatched) return "result";
  return "logic";
}

export function explainError(kind: ErrorKind, detail: string): ErrorExplanation {
  const excerpt = detail.replace(/\s+/g, " ").trim().slice(0, 180);
  const base: Record<ErrorKind, Omit<ErrorExplanation, "kind" | "label">> = {
    syntax: {
      what: "Le programme n'a pas pu être lu : un symbole obligatoire manque ou est en trop.",
      why: "Le langage a une grammaire stricte. Un guillemet, une parenthèse, une accolade, un point-virgule ou une indentation incorrecte arrête la lecture avant toute exécution.",
      fix: "Relisez la ligne citée. Fermez ce qui a été ouvert, et comparez avec l'exemple de la leçon.",
      avoid: "Écrivez une instruction complète à la fois, puis exécutez. N'empilez pas les modifications.",
    },
    undefined: {
      what: "Un nom est utilisé alors qu'aucune variable ou fonction ne le porte.",
      why: "L'ordinateur ne devine pas. Sans guillemets, un mot est un nom. S'il n'a pas été créé avant, l'exécution s'arrête.",
      fix: "Vérifiez l'orthographe, l'ordre des lignes, et si le texte devait être entre guillemets.",
      avoid: "Créez la variable avant de l'afficher. Relisez les majuscules : ville et Ville sont deux noms.",
    },
    type: {
      what: "Une opération mélange des valeurs qui ne vont pas ensemble.",
      why: "Un texte et un nombre ne se calculent pas de la même façon. Le langage refuse la conversion implicite, ou la fait d'une manière qui n'est pas celle attendue.",
      fix: "Regardez le type de chaque valeur. Affichez le nombre tel quel, ou convertissez explicitement si la leçon l'a montré.",
      avoid: "Ne mettez pas de guillemets autour d'un nombre que vous voulez calculer.",
    },
    condition: {
      what: "Le test ne choisit pas la branche attendue.",
      why: "if n'exécute son bloc que si la comparaison est vraie. else ne s'exécute que si elle est fausse. Un seul des deux chemins produit l'affichage.",
      fix: "Écrivez la comparaison demandée, puis les deux messages. Vérifiez l'ordre : le cas particulier avant le cas général.",
      avoid: "N'affichez pas le texte final sans le if. Le test fait partie de l'exercice.",
    },
    loop: {
      what: "La répétition ne produit pas la suite demandée.",
      why: "Une boucle répète un bloc. Oublier de modifier la variable qui sert de compteur, ou afficher les nombres un par un hors de la boucle, rate l'objectif.",
      fix: "Gardez l'affichage à l'intérieur de la boucle. Si vous utilisez while, diminuez le compteur à chaque tour.",
      avoid: "Ne recopiez pas trois print pour imiter une boucle. Le contrôle vérifie la structure.",
    },
    function: {
      what: "La fonction n'est pas définie, pas appelée, ou ne renvoie pas le calcul demandé.",
      why: "Définir une fonction ne l'exécute pas. L'appel le fait. return envoie une valeur à l'appelant ; un affichage dans la fonction n'est pas la même chose.",
      fix: "Écrivez le calcul dans return, puis laissez l'appel déjà présent. N'affichez pas le nombre final à la place.",
      avoid: "Ne remplacez pas l'appel par le résultat figé : la fonction doit rester utile pour d'autres nombres.",
    },
    logic: {
      what: "Le programme tourne, mais il ne fait pas ce que la leçon demande.",
      why: "La sortie peut coïncider avec l'exemple sans que la notion soit utilisée. Afficher le texte tout fait contourne l'exercice.",
      fix: "Relisez la consigne : variable, test, boucle ou fonction. Reprenez le programme de départ.",
      avoid: "Une sortie juste obtenue en collant la réponse n'est pas acceptée.",
    },
    result: {
      what: "Le programme s'est exécuté, mais le texte affiché n'est pas celui attendu.",
      why: "La comparaison est exacte : une majuscule, un espace, un accent ou un retour à la ligne de différence suffit à échouer.",
      fix: "Comparez le texte obtenu et le texte attendu, caractère par caractère.",
      avoid: "N'ajoutez pas de phrase autour du résultat si la consigne n'en demande pas.",
    },
    runtime: {
      what: "Le programme a démarré, puis une opération invalide l'a arrêté.",
      why: "Diviser par zéro, lire une case absente ou dépasser le temps autorisé interrompt l'exécution. Ce n'est pas une erreur de syntaxe.",
      fix: "Repérez la ligne citée. Vérifiez les bornes, les clés et les compteurs.",
      avoid: "Testez d'abord avec les valeurs de l'exemple avant de changer les données.",
    },
    misunderstanding: {
      what: "La consigne n'est pas respectée, même si une partie du résultat apparaît.",
      why: "L'exercice vérifie la notion du cours, pas seulement le texte final.",
      fix: "Relisez l'objectif et la marche à suivre. Reprenez le code de départ.",
      avoid: "Ne cherchez pas un raccourci qui affiche la réponse sans le mécanisme demandé.",
    },
  };
  const item = base[kind];
  return {
    kind,
    label: LABELS[kind],
    what: excerpt ? `${item.what} Détail : ${excerpt}` : item.what,
    why: item.why,
    fix: item.fix,
    avoid: item.avoid,
  };
}

export function formatExplanation(note: ErrorExplanation): string {
  return `Quoi. ${note.what}\n\nPourquoi. ${note.why}\n\nCorriger. ${note.fix}\n\nÉviter. ${note.avoid}`;
}

export function upsertJournal(list: JournalEntry[], entry: JournalEntry): JournalEntry[] {
  const now = Date.parse(entry.at);
  const recent = list.find((item) => {
    if (item.understood) return false;
    if (item.exerciseId !== entry.exerciseId || item.languageId !== entry.languageId) return false;
    return Math.abs(now - Date.parse(item.at)) < 120_000;
  });
  if (recent) {
    return list.map((item) =>
      item.id === recent.id ? { ...entry, id: recent.id, understood: false } : item,
    );
  }
  return [entry, ...list].slice(0, 60);
}

export function recurrentKeys(entries: JournalEntry[]): Array<{
  key: string;
  languageId: string;
  lessonId: string;
  lessonTitle: string;
  kind: ErrorKind;
  count: number;
}> {
  const map = new Map<string, {
    languageId: string;
    lessonId: string;
    lessonTitle: string;
    kind: ErrorKind;
    count: number;
  }>();
  for (const entry of entries) {
    if (entry.understood) continue;
    const key = `${entry.languageId}|${entry.lessonId}|${entry.kind}`;
    const current = map.get(key);
    if (current) current.count += 1;
    else {
      map.set(key, {
        languageId: entry.languageId,
        lessonId: entry.lessonId,
        lessonTitle: entry.lessonTitle,
        kind: entry.kind,
        count: 1,
      });
    }
  }
  return [...map.entries()]
    .filter(([, value]) => value.count >= 2)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => b.count - a.count);
}
