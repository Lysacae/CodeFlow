/**
 * Corrige le texte des leçons sans toucher aux validations.
 * - retire la bulle « Bienvenue… » du cours et du fichier modèle
 * - retire l'exemple print("Bonjour") recopié sur les leçons qui ne l'enseignent pas
 * - aligne « Comment ça marche » / « Résultat » sur le code affiché
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../content/tracks");

const HELLO = {
  python: 'print("Bonjour")',
  csharp: 'Console.WriteLine("Bonjour");',
  java: 'System.out.println("Bonjour");',
  cpp: 'std::cout << "Bonjour" << std::endl;',
};

const QUOTES = {
  python: 'print("Texte")\nprint(\'Autre texte\')',
  csharp: 'Console.WriteLine("Texte");\nConsole.WriteLine("Autre texte");',
  java: 'System.out.println("Texte");\nSystem.out.println("Autre texte");',
  cpp: 'std::cout << "Texte" << std::endl;\nstd::cout << "Autre texte" << std::endl;',
};

const PROJECT = {
  python: 'charge = 85\nif charge >= 80:\n    print("Niveau eleve")\nelse:\n    print("Niveau normal")',
  csharp:
    'int charge = 85;\nif (charge >= 80)\n{\n    Console.WriteLine("Niveau eleve");\n}\nelse\n{\n    Console.WriteLine("Niveau normal");\n}',
  java: 'int charge = 85;\nif (charge >= 80) {\n    System.out.println("Niveau eleve");\n} else {\n    System.out.println("Niveau normal");\n}',
  cpp: 'int charge = 85;\nif (charge >= 80) {\n    std::cout << "Niveau eleve" << std::endl;\n} else {\n    std::cout << "Niveau normal" << std::endl;\n}',
};

function tagOf(id) {
  const rules = [
    [/what-is/, "what"],
    [/why/, "why"],
    [/how-program|-l1-how$/, "run"],
    [/source/, "source"],
    [/editor/, "editor"],
    [/indent/, "indent"],
    [/errors/, "errors"],
    [/l2-print$/, "print"],
    [/several-prints$|l2-lines$/, "lines"],
    [/comments$/, "comments"],
    [/quotes$|l2-syntax$/, "quotes"],
    [/first-file$/, "file"],
    [/declare$/, "declare"],
    [/names$/, "names"],
    [/types$/, "types"],
    [/modify$/, "modify"],
    [/concat$/, "concat"],
    [/numbers$/, "numbers"],
    [/l4-conditions$/, "if"],
    [/else-if$/, "elif"],
    [/l4-else$/, "else4"],
    [/l5-else$/, "else5"],
    [/operators$|compare$/, "cmp"],
    [/and-or$/, "andor"],
    [/l4-loops$/, "for0"],
    [/l4-while$/, "whileUp"],
    [/c2-for$/, "for1"],
    [/c3-while$/, "whileDown"],
    [/accumulate$/, "acc"],
    [/collections$/, "list"],
    [/functions$/, "fn"],
    [/c2-project$/, "diag"],
    [/c2-strings$/, "strings"],
    [/compose$/, "compose"],
    [/escape$/, "escape"],
    [/combine$/, "combine"],
    [/fix$/, "fix"],
    [/mini$/, "mini"],
    [/decision$/, "decision"],
    [/return$/, "ret"],
    [/produit$/, "produit"],
    [/somme$/, "somme"],
    [/dict-sum$/, "dictsum"],
    [/dict$/, "dict"],
    [/branch$/, "branch"],
    [/c3-text$/, "text"],
    [/words$/, "words"],
    [/ligne$/, "ligne"],
    [/c3-project$/, "ticket"],
  ];
  for (const [re, tag] of rules) if (re.test(id)) return tag;
  return null;
}

function setHeading(lesson, heading, body) {
  const section = lesson.sections.find((s) => s.heading === heading);
  if (!section || section.body === body) return false;
  section.body = body;
  return true;
}

function replaceCode(lesson, next) {
  const section = lesson.sections.find((s) => s.type === "code");
  if (!section || section.code === next) return false;
  section.code = next;
  return true;
}

function dropHello(lesson, lang) {
  const index = lesson.sections.findIndex((s) => s.type === "code" && s.code === HELLO[lang]);
  if (index < 0) return false;
  lesson.sections.splice(index, 1);
  return true;
}

function patchCode(lang, tag, lesson) {
  const code = lesson.sections.find((s) => s.type === "code")?.code || "";
  if (tag === "why" || tag === "run") return dropHello(lesson, lang);
  if (tag === "quotes" && code === HELLO[lang]) return replaceCode(lesson, QUOTES[lang]);
  if (tag === "for0") {
    if (lang === "python") return replaceCode(lesson, code.replace("range(2)", "range(3)"));
    return replaceCode(lesson, code.replace("i < 2", "i < 3"));
  }
  if (tag === "for1") {
    if (lang === "python") return replaceCode(lesson, code.replace("range(1, 3)", "range(1, 4)"));
    return replaceCode(lesson, code.replace("i <= 2", "i <= 3"));
  }
  if (tag === "whileDown") return replaceCode(lesson, code.replace("n = 2", "n = 3"));
  if (tag === "decision") return replaceCode(lesson, code.replace("points = 4", "points = 15"));
  if (tag === "diag") return replaceCode(lesson, PROJECT[lang]);
  return false;
}

function copyFor(lang, tag) {
  const py = lang === "python";
  const semi = py ? "Pas de point-virgule en fin de ligne." : "Chaque instruction se termine par un point-virgule.";
  const and = py ? "and" : "&&";
  const or = py ? "or" : "||";
  const upper =
    lang === "python" ? "upper()" : lang === "csharp" ? "ToUpper()" : lang === "java" ? "toUpperCase()" : "size()";

  const map = {
    what: {
      how: py
        ? 'print("Bonjour") est un ordre d\'affichage. Le texte entre guillemets est la donnée. print est le verbe.'
        : lang === "csharp"
          ? 'Console.WriteLine("Bonjour"); affiche le mot. Les guillemets délimitent le texte, le point-virgule termine l\'instruction.'
          : lang === "java"
            ? 'System.out.println("Bonjour"); affiche le mot. Les guillemets délimitent le texte, le point-virgule termine l\'instruction.'
            : 'std::cout << "Bonjour" << std::endl; affiche le mot puis passe à la ligne.',
      result: "La Sortie ne contient que Bonjour, sans les guillemets.",
      recap: `Un programme ne fait que ce qui est écrit, dans l'ordre. ${semi}`,
    },
    why: {
      how: py
        ? "On choisit souvent Python pour débuter : l'écriture reste proche d'une phrase, avec peu de symboles autour du texte."
        : lang === "csharp"
          ? "C# sert à écrire des applications et des outils. Chaque instruction est explicite, et le compilateur signale les oublis avant l'exécution."
          : lang === "java"
            ? "Java impose une classe et une méthode main. Cette structure se retrouve dans presque tous les programmes du parcours."
            : "C++ vise des programmes efficaces. On commence ici par afficher, stocker, décider et répéter.",
      result: "Rien à exécuter dans cette leçon : le geste d'affichage arrive juste après.",
      recap: py
        ? "Python reste lisible. Les guillemets, puis l'indentation, deviennent des règles dès la leçon suivante."
        : `${lang === "csharp" ? "C#" : lang === "java" ? "Java" : "C++"} se lit clairement. ${semi}`,
    },
    run: {
      how: py
        ? "L'interpréteur lit le fichier de haut en bas, sans compilation. Une ligne fausse arrête le programme et la Sortie montre l'erreur réelle."
        : lang === "csharp"
          ? "Le SDK .NET compile le programme, puis l'exécution produit la Sortie. Si la compilation échoue, rien ne s'exécute."
          : lang === "java"
            ? "javac compile la classe, puis la JVM exécute main. Une erreur de compilation empêche le démarrage."
            : "Le compilateur produit le programme, puis main démarre. Une erreur de compilation empêche le lancement.",
      result: "Un programme correct affiche son message. Un programme incorrect montre l'erreur, pas un résultat inventé.",
      recap: "Lisez toujours la Sortie après un essai.",
    },
    errors: {
      how: py
        ? "Le message cite souvent SyntaxError ou NameError, et un numéro de ligne. Corrigez cette ligne, puis relancez."
        : lang === "csharp"
          ? "Le message cite souvent un code CS et un numéro de ligne. Corrigez cette ligne, puis relancez."
          : lang === "java"
            ? "javac indique le fichier, la ligne et le symbole inattendu. Corrigez cette ligne, puis relancez."
            : "Le compilateur indique le fichier, la ligne et le symbole inattendu. Corrigez cette ligne, puis relancez.",
      result: "Après correction, l'erreur disparaît et la Sortie montre le résultat, ou une erreur suivante plus précise.",
      recap: "Une erreur de syntaxe empêche l'exécution. Une erreur plus tard veut dire que la lecture a réussi, puis qu'une opération a échoué.",
    },
    print: {
      how: py
        ? 'print("Bonjour !") envoie Bonjour ! Les guillemets ne sortent pas.'
        : lang === "csharp"
          ? 'Console.WriteLine("Bonjour !"); envoie Bonjour ! Les guillemets ne sortent pas.'
          : lang === "java"
            ? 'System.out.println("Bonjour !"); envoie Bonjour ! Les guillemets ne sortent pas.'
            : 'std::cout << "Bonjour !" << std::endl; envoie Bonjour ! Les guillemets ne sortent pas.',
      result: "La Sortie de l'exemple est : Bonjour !",
      recap: "Changer le texte entre guillemets change la sortie. L'exercice demande une autre phrase, avec l'accent et le point d'exclamation.",
    },
    quotes: {
      how: py
        ? "Les guillemets doubles et les guillemets simples délimitent le texte. Les parenthèses entourent ce que print affiche. Pas de point-virgule."
        : `Les guillemets délimitent le texte. ${semi}`,
      result: "Deux lignes : Texte, puis Autre texte.",
      recap: "Un guillemet fermé trop tôt fait lire la suite comme du code, et l'exécution s'arrête.",
    },
    declare: {
      how: py
        ? "ville contient Lyon. print(ville) lit la boîte : le nom s'écrit sans guillemets."
        : "La variable ville contient Lyon. L'affichage reçoit le nom, sans guillemets, pour lire la boîte.",
      result: "La Sortie de l'exemple est Lyon. L'exercice demande Paris.",
      recap: "Afficher le nom de la variable et afficher un texte entre guillemets ne sont pas le même geste.",
    },
    modify: {
      how: "La deuxième affectation remplace la première. L'affichage est placé après, donc il voit la dernière valeur.",
      result: "La Sortie de l'exemple est 2. L'exercice part de 0, passe à 10, et doit afficher 10.",
      recap: "L'ordre des lignes compte. Un affichage entre les deux affectations montrerait encore l'ancienne valeur.",
    },
    numbers: {
      how: py
        ? "a vaut 4 et b vaut 2. a + b calcule 6. Des guillemets autour de ces nombres en feraient du texte."
        : "a vaut 4 et b vaut 2. a + b calcule 6. Des guillemets autour de ces nombres en feraient du texte.",
      result: "La Sortie de l'exemple est 6. L'exercice demande 7 + 3, donc 10.",
      recap: "Affichez le calcul, pas le nombre déjà écrit. Le résultat figé est refusé.",
    },
    concat: {
      how: 'L\'espace fait partie du texte "Bonjour ". Le collage ajoute la valeur de prenom, ici Lea.',
      result: "La Sortie de l'exemple est Bonjour Lea. L'exercice utilise Sam.",
      recap: "Écrire Bonjour Sam d'un seul bloc contourne l'exercice : la variable ne sert plus.",
    },
    strings: {
      how: "prenom contient Lea. Afficher la variable montre Lea. Afficher un autre texte entre guillemets ignore la variable.",
      result: "La Sortie de l'exemple est Bonjour Lea.",
      recap: "Un texte peut contenir des espaces. Ils comptent dans la Sortie.",
    },
    compose: {
      how: 'L\'espace est dans "Bonjour ". prenom vaut Alex, donc l\'assemblage est Bonjour Alex.',
      result: "La Sortie de l'exemple est Bonjour Alex. L'exercice assemble Bonjour et CodeFlow.",
      recap: "Ne remplacez pas la variable par le mot CodeFlow dans les guillemets.",
    },
    if: {
      how: "score vaut 15. 15 >= 10 est vrai, donc le bloc affiche OK. Avec 9, ce bloc serait sauté.",
      result: "La Sortie de l'exemple est OK. L'exercice affiche Réussi, toujours avec un test.",
      recap: "Afficher le message sans le test réussit parfois la Sortie et rate la notion.",
    },
    else4: {
      how: "20 n'est pas supérieur à 25, donc else s'exécute et affiche Frais.",
      result: "La Sortie de l'exemple est Frais. L'exercice utilise 5 et le seuil 10 : la Sortie doit être Froid.",
      recap: "if et else ne s'exécutent pas ensemble. Sans else, un test faux n'affiche rien.",
    },
    else5: {
      how: "age vaut 20. 20 >= 18 est vrai, donc if affiche Majeur. else servirait pour un âge plus petit.",
      result: "L'exemple affiche Majeur. L'exercice part de 15 et doit afficher Mineur.",
      recap: "Gardez les deux branches. L'exercice note la branche else.",
    },
    elif: {
      how: "note vaut 7. Le premier test, 7 < 10, est vrai, donc Faible. Les tests suivants ne sont pas lus.",
      result: "La Sortie de l'exemple est Faible. L'exercice part de 14 et doit afficher Bien.",
      recap: "L'ordre des seuils compte. Un seuil large placé en premier avale les cas plus précis.",
    },
    andor: {
      how: `${and} exige que les deux côtés soient vrais. ${or} suffit qu'un côté soit vrai. Ici 20 est entre 18 et 26.`,
      result: "La Sortie est Jeune adulte.",
      recap: "Écrivez deux comparaisons complètes. Un mot seul entre les deux n'est pas un test.",
    },
    for0: {
      how: py
        ? "range(3) donne 0, puis 1, puis 2. print(i) est dans la boucle, donc il se répète."
        : "i part de 0 et s'arrête avant 3. L'affichage de i est dans la boucle, donc il se répète.",
      result: "Trois lignes : 0, puis 1, puis 2.",
      recap: "Trois affichages copiés hors de la boucle imitent la sortie et ratent la notion.",
    },
    for1: {
      how: py
        ? "range(1, 4) commence à 1 et s'arrête avant 4. print(i) est dans la boucle."
        : "i part de 1 et continue tant qu'il n'a pas dépassé 3. L'affichage de i est dans la boucle.",
      result: "Trois lignes : 1, puis 2, puis 3.",
      recap: "Affichez i dans la boucle. N'écrivez pas les trois nombres à la main.",
    },
    whileUp: {
      how: "n commence à 0. Tant que n < 2, on affiche n puis on lui ajoute 1.",
      result: "Deux lignes : 0, puis 1.",
      recap: "Si n ne change pas, la boucle ne s'arrête pas.",
    },
    whileDown: {
      how: "n commence à 3. Tant que n > 0, on affiche n puis on retire 1.",
      result: "Trois lignes : 3, puis 2, puis 1.",
      recap: "L'affichage et la diminution sont dans la boucle. L'un sans l'autre ne convient pas.",
    },
    list: {
      how: "L'index 0 est la première case. Dans l'exemple, elle vaut 2.",
      result: "La Sortie de l'exemple est 2. L'exercice lit la première case d'une autre collection : 10.",
      recap: "Écrire 10 directement ne lit pas la collection. L'index 1 n'est pas la première case.",
    },
    fn: {
      how: "La fonction est définie, puis appelée. Sans l'appel, la Sortie reste vide.",
      result: "La Sortie de l'exemple est Ok. L'exercice demande Pret.",
      recap: "Remplacer l'appel par un affichage direct saute la notion.",
    },
    diag: {
      how: "charge vaut 85. 85 >= 80 est vrai, donc le premier message s'affiche. else couvre une charge plus basse.",
      result: "La Sortie est Niveau eleve, sans accent : c'est le texte exact demandé.",
      recap: "Les deux messages restent écrits. Un seul s'exécute.",
    },
    branch: {
      how: "couleur vaut 1, le premier cas affiche Rouge. Le cas par défaut ne s'exécute pas.",
      result: "La Sortie de l'exemple est Rouge. L'exercice ajoute le cas 3 pour afficher Mercredi.",
      recap: "Le cas précis se place avant le cas par défaut, sinon le défaut vole l'exécution.",
    },
    text:
      lang === "cpp"
        ? {
            objective: "Compter les caractères d'un texte, sans écrire le nombre à la main.",
            how: "mot vaut oui. size() compte les caractères : 3. On affiche ce nombre, pas le mot.",
            result: "La Sortie de l'exemple est 3. L'exercice compte codeflow, donc 8.",
            recap: "Écrire 8 directement ne compte rien. Il faut appeler size() ou length().",
          }
        : {
            how: `${upper} fabrique un nouveau texte en majuscules. ok devient OK. La variable d'origine ne change pas.`,
            result: "La Sortie de l'exemple est OK. L'exercice part de codeflow et doit afficher CODEFLOW.",
            recap: "Taper CODEFLOW entre guillemets ignore la variable. L'exercice le refuse.",
          },
    words: {
      how: "Le découpage coupe sur les espaces. « un deux » donne deux mots. On compte les morceaux, pas les lettres.",
      result: "La Sortie de l'exemple est 2. L'exercice compte une phrase de 3 mots.",
      recap: "Écrire 3 directement ne découpe rien. L'outil de découpage doit rester visible.",
    },
    acc: {
      how: "total commence à 0. Chaque tour lui ajoute 1. L'affichage est après la boucle, une seule fois.",
      result: "La Sortie de l'exemple est 2.",
      recap: "Afficher le total dans la boucle montrerait les totaux intermédiaires.",
    },
    dict: {
      how: "La clé est un texte, entre guillemets. ages[\"Sam\"] vaut 11. Une clé absente est une erreur.",
      result: "La Sortie de l'exemple est 11. L'exercice lit une autre clé, qui vaut 18.",
      recap: "Écrire 18 directement ne consulte pas la table.",
    },
    dictsum: {
      how: "La boucle visite chaque entrée et ajoute la valeur au total, pas la clé. L'affichage est après la boucle.",
      result: "La Sortie de l'exemple est 2. L'exercice additionne d'autres valeurs et doit afficher 6.",
      recap: "Un affichage avant la boucle montrerait 0.",
    },
    ret: {
      how: "return quitte la fonction et donne le résultat à l'appel. double(3) calcule 6, puis l'appelant l'affiche.",
      result: "La Sortie de l'exemple est 6.",
      recap: "Un return figé ne sert que pour une valeur. Le return du calcul sert pour toutes.",
    },
    mini: {
      how: 'nom vaut Nina. Le collage de "Bonjour " et de nom donne Bonjour Nina.',
      result: "La Sortie de l'exemple est Bonjour Nina. L'exercice utilise Alex.",
      recap: "Le texte tout fait Bonjour Alex est refusé : la variable doit servir.",
    },
    decision: {
      how: "points vaut 15. 15 >= 10 est vrai, donc le bloc affiche Validé.",
      result: "La Sortie est Validé.",
      recap: "Gardez le if. Un affichage seul ne montre pas la décision.",
    },
    fix: {
      how: "Le mot CodeFlow est un texte. Il lui faut un guillemet ouvrant et un guillemet fermant.",
      result: "La Sortie est CodeFlow.",
      recap: "Un commentaire ne répare pas la syntaxe. Il faut corriger la ligne.",
    },
  };
  return map[tag] || null;
}

function cleanPrompt(prompt) {
  const parts = prompt.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const next = [];
  for (const part of parts) {
    if (part.startsWith("Objectif.")) continue;
    if (part.startsWith("Contraintes.")) {
      const match = part.match(/La sortie comparée est exactement « ([^»]+) »/);
      if (match) {
        const shown = match[1].replace(/↵/g, "\n").split("\n").join(" puis ");
        next.push(`La Sortie doit être exactement : ${shown}.`);
      }
      continue;
    }
    next.push(part.replace(/^Marche à suivre\.\s*/, ""));
  }
  return next.join("\n\n");
}

function cleanPrereq(body) {
  return body
    .replace(/\s*Aucune autre notion n'est utilisée\./g, "")
    .replace("Prérequis : aucun. C'est le point de départ du parcours.", "Aucun. C'est le début du parcours.")
    .replace(/^Prérequis : /, "")
    .trim();
}

const report = { lessons: 0, rewritten: 0, bubblesRemoved: 0, prompts: 0, welcomeLeft: [] };

for (const lang of ["python", "csharp", "cpp", "java"]) {
  const file = path.join(root, lang, "track.json");
  const track = JSON.parse(fs.readFileSync(file, "utf8"));
  const beforeExpected = [];
  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      if (lesson.exercise) beforeExpected.push([lesson.exercise.id, lesson.exercise.validate.expected, lesson.exercise.starterCode]);
    }
  }

  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      report.lessons += 1;
      const tag = tagOf(lesson.id);
      let changed = false;
      if (patchCode(lang, tag, lesson)) {
        changed = true;
        report.bubblesRemoved += 1;
      }
      const copy = copyFor(lang, tag);
      if (copy) {
        if (copy.objective && setHeading(lesson, "Objectif", copy.objective)) changed = true;
        if (setHeading(lesson, "Comment ça marche", copy.how)) changed = true;
        if (setHeading(lesson, "Résultat attendu", copy.result)) changed = true;
        if (setHeading(lesson, "À retenir", copy.recap)) changed = true;
      }
      for (const section of lesson.sections) {
        if (section.heading === "Prérequis" && section.body) {
          const next = cleanPrereq(section.body);
          if (next !== section.body) {
            section.body = next;
            changed = true;
          }
        }
      }
      if (lesson.exercise) {
        const next = cleanPrompt(lesson.exercise.prompt);
        if (next && next !== lesson.exercise.prompt) {
          lesson.exercise.prompt = next;
          report.prompts += 1;
          changed = true;
        }
      }
      if (lesson.fileWizard?.starterCode?.includes("Bienvenue dans la programmation !")) {
        lesson.fileWizard.starterCode = lesson.fileWizard.starterCode.replaceAll(
          "Bienvenue dans la programmation !",
          "Bonjour",
        );
        changed = true;
        report.bubblesRemoved += 1;
      }
      if (changed) report.rewritten += 1;
      const blob = JSON.stringify({ sections: lesson.sections, fileWizard: lesson.fileWizard || null });
      if (blob.includes("Bienvenue dans la programmation")) report.welcomeLeft.push(lesson.id);
    }
  }

  const after = [];
  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      if (lesson.exercise) after.push([lesson.exercise.id, lesson.exercise.validate.expected, lesson.exercise.starterCode]);
    }
  }
  if (JSON.stringify(beforeExpected) !== JSON.stringify(after)) {
    throw new Error(`Validation ou starter modifié pour ${lang}`);
  }
  fs.writeFileSync(file, JSON.stringify(track, null, 2) + "\n");
}

console.log(JSON.stringify(report, null, 2));
