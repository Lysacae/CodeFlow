/**
 * Remplace les consignes génériques par des explications A→Z,
 * corrige les confusions, ajoute indentation + else.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../content/tracks");

const GENERIC =
  /^Lisez la consigne jusqu'au bout avant d'écrire\.\n\nVotre programme doit produire exactement le texte demandé dans la zone Sortie\.\n\nChaque symbole compte : guillemets, majuscules et, selon le langage, le point-virgule\.\n\n/;

function load(lang) {
  return JSON.parse(fs.readFileSync(path.join(root, lang, "track.json"), "utf8"));
}
function save(lang, data) {
  fs.writeFileSync(path.join(root, lang, "track.json"), JSON.stringify(data, null, 2) + "\n");
}

function stripGeneric(prompt) {
  return prompt.replace(GENERIC, "").trim();
}

function pack(explanation, task) {
  return `${explanation.trim()}\n\n${task.trim()}`;
}

const PRINT = {
  python: (s) => `print("${s}")`,
  csharp: (s) => `Console.WriteLine("${s}");`,
  java: (s) => `System.out.println("${s}");`,
  cpp: (s) => `std::cout << "${s}" << std::endl;`,
};

const NAME = { python: "Python", csharp: "C#", java: "Java", cpp: "C++" };

/** Explications spécifiques par id d'exercice (tous langages). */
function explainFor(lang, exerciseId, fallbackTask) {
  const n = NAME[lang];
  const p = PRINT[lang];
  const map = {
    // Premier print
    [`${lang}-l2-ex1`]: pack(
      `Vous allez utiliser la commande d'affichage de ${n}.\n\nElle envoie du texte dans la zone Sortie.\n\nLe texte à afficher doit être entre guillemets.\n\nModifiez le programme de départ : remplacez le texte actuel par exactement Bienvenue dans la programmation ! (accents et ponctuation inclus).`,
      `Faites afficher : Bienvenue dans la programmation !`,
    ),
    [`${lang}-l2-ex2`]: pack(
      `Vous pouvez appeler l'affichage plusieurs fois.\n\nChaque appel produit une nouvelle ligne dans la Sortie.\n\nÉcrivez deux affichages : le premier pour CodeFlow, le second pour ${n}.`,
      `Affichez CodeFlow puis ${n}, chacun sur sa propre ligne.`,
    ),
    // Variables
    [`${lang}-l3-ex1`]: pack(
      `Une variable est une boîte nommée qui stocke une valeur.\n\nIci, créez une variable ville qui contient le texte Paris (entre guillemets).\n\nEnsuite, affichez le contenu de ville — pas le mot « ville » entre guillemets, mais la variable elle-même.`,
      `Créez ville = "Paris", puis affichez cette variable.`,
    ),
    [`${lang}-l3-ex2`]: pack(
      `On peut changer la valeur d'une variable après l'avoir créée.\n\nCommencez avec score égal à 0.\n\nPuis donnez-lui la nouvelle valeur 10.\n\nEnfin, affichez score : la Sortie doit montrer 10 (la dernière valeur).`,
      `score commence à 0, passe à 10, puis affichez score.`,
    ),
    [`${lang}-l3-ex3`]:
      lang === "python"
        ? pack(
            `Le symbole + colle deux textes (concaténation).\n\nAttention : le nom de la variable et le texte affiché ne doivent pas se ressembler pour éviter la confusion.\n\nCréez une variable prenom qui contient Sam.\n\nPuis affichez le texte fixe "Bonjour " collé à prenom.\n\nRésultat attendu : Bonjour Sam`,
            `Avec prenom = "Sam", affichez Bonjour Sam`,
          )
        : pack(
            `On assemble souvent un texte fixe et une variable.\n\nCréez une variable prenom qui contient Sam.\n\nAffichez Bonjour suivi d'un espace, puis la valeur de prenom.`,
            `Avec prenom = "Sam", affichez Bonjour Sam`,
          ),
    [`${lang}-l3-ex4`]: pack(
      `Les nombres se calculent avec + - * /.\n\nPlacez 7 dans a et 3 dans b.\n\nAffichez le résultat de a + b (pas le texte "a + b", le calcul).`,
      `a = 7, b = 3, affichez leur somme (10).`,
    ),
    // Conditions
    [`${lang}-l4-ex1`]: pack(
      `if teste une condition.\n\nSi le test est vrai, les instructions indentées (ou entre { } selon le langage) s'exécutent.\n\nIci score vaut déjà 12.\n\nSi score est supérieur ou égal à 10, affichez Réussi.`,
      `Si score >= 10, affichez Réussi.`,
    ),
    [`${lang}-l4-ex2`]: pack(
      `else signifie « sinon » : le cas où le if est faux.\n\nSans else, si le test échoue, rien ne s'affiche.\n\nAvec else, vous choisissez toujours un message.\n\ntemperature vaut 5.\n\nSi temperature < 10 → Froid, sinon → Doux.\n\nComme 5 < 10, la Sortie doit être Froid.`,
      `temperature = 5 : affichez Froid si < 10, sinon Doux.`,
    ),
    [`${lang}-l4-ex3`]: pack(
      `Une boucle for répète un bloc plusieurs fois.\n\nrange(3) donne 0, puis 1, puis 2.\n\nÀ chaque tour, affichez la valeur courante.`,
      `Affichez 0, 1 et 2 avec for et range(3) (Python) ou une boucle équivalente.`,
    ),
    // Niveau 5 — plus de doublon avec l3
    [`${lang}-l5-ex1`]: pack(
      `Reprenez les variables et le calcul, avec des nombres différents.\n\nStockez 4 dans x et 6 dans y.\n\nAffichez le produit x * y.`,
      `x = 4, y = 6, affichez le produit (24).`,
    ),
    [`${lang}-l5-ex2`]: pack(
      `Le starter contient une erreur de syntaxe (guillemets).\n\nLisez le message d'erreur, corrigez la ligne, puis affichez exactement CodeFlow.`,
      `Corrigez le programme pour afficher CodeFlow.`,
    ),
    // Python : l5-ex3 = salutation, l5-ex4 = Validé
    // C#/C++/Java : l5-ex3 = Validé (pas de mini salutation séparée)
    [`${lang}-l5-ex3`]:
      lang === "python"
        ? pack(
            `Créez une variable nom contenant Alex.\n\nAssemblez le texte "Bonjour " avec cette variable, puis affichez le résultat.`,
            `nom = "Alex", affichez Bonjour Alex`,
          )
        : pack(
            `points vaut 15.\n\nUtilisez if : si points >= 10, affichez Validé.\n\nIci le test est vrai, donc Validé doit apparaître.`,
            `Avec points = 15, affichez Validé si points >= 10.`,
          ),
    [`${lang}-l5-ex4`]: pack(
      `points vaut 15.\n\nUtilisez if : si points >= 10, affichez Validé.\n\nIci le test est vrai, donc Validé doit apparaître.`,
      `Avec points = 15, affichez Validé si points >= 10.`,
    ),
    [`${lang}-l5-ex-else`]: pack(
      `else sert quand le if est faux.\n\nage vaut 15.\n\nSi age >= 18, affichez Majeur.\n\nSinon (else), affichez Mineur.\n\nComme 15 < 18, la Sortie doit être Mineur — c'est le rôle de else.`,
      `age = 15 : Majeur si >= 18, sinon Mineur.`,
    ),
    // Chapitre 2 (déjà un peu mieux, on enrichit si générique)
    [`${lang}-c2-ex1`]: pack(
      `Composez un message en plusieurs morceaux.\n\nUne variable contient CodeFlow.\n\nAffichez Bonjour suivi d'un espace et de cette variable.`,
      `Affichez exactement Bonjour CodeFlow.`,
    ),
    [`${lang}-c2-ex2`]: pack(
      `Enchaînez plusieurs tests (if / else if / else selon le langage).\n\nnote vaut 14.\n\nChoisissez le bon message selon les seuils donnés.`,
      `Avec note = 14, affichez Bien.`,
    ),
    [`${lang}-c2-ex3`]: pack(
      `Utilisez une boucle pour afficher 1, 2 et 3, chacun sur sa ligne.\n\nÉvitez de copier trois affichages à la main.`,
      `Affichez 1, 2 et 3 avec une boucle.`,
    ),
    [`${lang}-c2-ex4`]: pack(
      `Créez une petite collection (liste / tableau) avec 10 puis 20.\n\nAffichez uniquement la première valeur.`,
      `Affichez 10 (première valeur).`,
    ),
    [`${lang}-c2-ex5`]: pack(
      `Affichez exactement Pret.\n\nVous pouvez passer par une fonction simple ou un affichage direct.`,
      `Affichez Pret.`,
    ),
    [`${lang}-c2-ex6`]: pack(
      `charge vaut 85.\n\nSi charge >= 80, affichez Niveau eleve, sinon Niveau normal.`,
      `Avec charge = 85, affichez Niveau eleve.`,
    ),
  };

  if (map[exerciseId]) return map[exerciseId];
  // Fallback : explication minimale + tâche d'origine
  return pack(
    `Écrivez le programme étape par étape.\n\nVérifiez la Sortie après chaque essai.`,
    fallbackTask,
  );
}

function indentLesson(lang) {
  if (lang === "python") {
    return {
      id: "python-l1-indent",
      title: "L'indentation (espaces)",
      sections: [
        {
          type: "prose",
          body:
            "En Python, les espaces en début de ligne s'appellent l'indentation.\n\nIls indiquent quelles lignes appartiennent à un même bloc (par exemple sous un if).\n\nSans la bonne indentation, Python refuse d'exécuter le programme.",
        },
        {
          type: "code",
          code: 'age = 18\nif age >= 18:\n    print("Majeur")',
        },
        {
          type: "prose",
          body:
            "Sous le if, print est décalé (souvent 4 espaces).\n\nCe décalage dit : « cette ligne fait partie du if ».\n\nVous reverrez l'indentation dès les conditions.",
        },
      ],
    };
  }
  return {
    id: `${lang}-l1-indent`,
    title: "Blocs et indentation",
    sections: [
      {
        type: "prose",
        body:
          `En ${NAME[lang]}, un bloc d'instructions est souvent délimité par des accolades { }.\n\nOn indente (décale) le code à l'intérieur pour le lire clairement, même si le compilateur se fie surtout aux accolades.`,
      },
      {
        type: "code",
        code:
          lang === "csharp"
            ? 'int age = 18;\nif (age >= 18)\n{\n    Console.WriteLine("Majeur");\n}'
            : lang === "java"
              ? 'int age = 18;\nif (age >= 18) {\n    System.out.println("Majeur");\n}'
              : 'int age = 18;\nif (age >= 18) {\n    std::cout << "Majeur" << std::endl;\n}',
      },
      {
        type: "prose",
        body:
          "Prenez l'habitude d'indenter dès maintenant : cela évite les erreurs de lecture quand les programmes grossissent.",
      },
    ],
  };
}

function elseExercise(lang) {
  const starter =
    lang === "python"
      ? "age = 15\n"
      : lang === "csharp"
        ? "int age = 15;\n"
        : lang === "java"
          ? "public class Main {\n    public static void main(String[] args) {\n        int age = 15;\n        \n    }\n}"
          : "#include <iostream>\n\nint main() {\n    int age = 15;\n    \n    return 0;\n}";
  return {
    id: `${lang}-l5-else`,
    title: "Comprendre else",
    sections: [
      {
        type: "prose",
        body:
          "else = le chemin alternatif.\n\nSi la condition du if est fausse, c'est le bloc else qui s'exécute.\n\nSans else, le programme ne dirait rien quand le test échoue.",
      },
      {
        type: "code",
        code:
          lang === "python"
            ? 'age = 15\nif age >= 18:\n    print("Majeur")\nelse:\n    print("Mineur")'
            : lang === "csharp"
              ? 'int age = 15;\nif (age >= 18)\n{\n    Console.WriteLine("Majeur");\n}\nelse\n{\n    Console.WriteLine("Mineur");\n}'
              : lang === "java"
                ? 'int age = 15;\nif (age >= 18) {\n    System.out.println("Majeur");\n} else {\n    System.out.println("Mineur");\n}'
                : 'int age = 15;\nif (age >= 18) {\n    std::cout << "Majeur" << std::endl;\n} else {\n    std::cout << "Mineur" << std::endl;\n}',
      },
    ],
    exercise: {
      id: `${lang}-l5-ex-else`,
      prompt: "", // rempli plus bas
      hint:
        lang === "python"
          ? 'if age >= 18:\n    print("Majeur")\nelse:\n    print("Mineur")'
          : "Écrivez if … else … avec les deux messages.",
      starterCode: starter,
      validate: { type: "stdoutEquals", expected: "Mineur" },
    },
  };
}

function patchTrack(lang) {
  const track = load(lang);

  // 1) Insérer leçon indentation en fin du niveau 1 (Découverte)
  const level1 = track.levels.find((l) => l.id === 1);
  if (level1 && !level1.lessons.some((l) => l.id.includes("-l1-indent"))) {
    const errorsIdx = level1.lessons.findIndex((l) => l.id.includes("-l1-errors"));
    const lesson = indentLesson(lang);
    if (errorsIdx >= 0) level1.lessons.splice(errorsIdx, 0, lesson);
    else level1.lessons.push(lesson);
  }

  // 2) Enrichir leçon else existante
  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      if (lesson.id.endsWith("-l4-else")) {
        lesson.title = "À quoi sert else ?";
        lesson.sections = [
          {
            type: "prose",
            body:
              "if traite le cas « oui ».\n\nelse traite le cas « non ».\n\nEnsemble, ils couvrent les deux possibilités d'un test.",
          },
          {
            type: "prose",
            body:
              "Exemple : si la température est basse, afficher Froid ; sinon, afficher Doux.\n\nSans else, le programme resterait silencieux quand il ne fait pas froid.",
          },
          ...lesson.sections.filter((s) => s.type === "code"),
        ];
      }

      // 3) Titre / prose en double sur l5-combine
      if (lesson.id.endsWith("-l5-combine")) {
        lesson.title = "Multiplier deux nombres";
        lesson.sections = [
          {
            type: "prose",
            body:
              "Vous combinez deux variables numériques et un opérateur.\n\nCette fois, ce n'est pas une somme : c'est un produit (*).",
          },
        ];
      }

      // 4) Concat sans confusion langage/Langage
      if (lesson.id.endsWith("-l3-concat") && lang === "python") {
        lesson.exercise.starterCode = 'prenom = "Sam"\n';
        lesson.exercise.hint = 'print("Bonjour " + prenom)';
        lesson.exercise.validate.expected = "Bonjour Sam";
      }
    }
  }

  // 5) Ajouter exercice else dédié dans niveau 5
  const level5 = track.levels.find((l) => l.id === 5);
  if (level5 && !level5.lessons.some((l) => l.id.endsWith("-l5-else"))) {
    const insertAt = Math.max(
      0,
      level5.lessons.findIndex((l) => l.id.endsWith("-l5-decision")),
    );
    const lesson = elseExercise(lang);
    if (insertAt >= 0) level5.lessons.splice(insertAt, 0, lesson);
    else level5.lessons.push(lesson);
  }

  // 6) Réécrire tous les prompts d'exercices
  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      if (!lesson.exercise) continue;
      const task = stripGeneric(lesson.exercise.prompt);
      // Si déjà une longue explication custom (chapitre 2), on remplace quand même via map
      lesson.exercise.prompt = explainFor(lang, lesson.exercise.id, task);

      // Starters concat autres langages
      if (lesson.exercise.id === `${lang}-l3-ex3`) {
        lesson.exercise.validate.expected = "Bonjour Sam";
        if (lang === "csharp") {
          lesson.exercise.starterCode = 'string prenom = "Sam";\n';
          lesson.exercise.hint = 'Console.WriteLine("Bonjour " + prenom);';
        } else if (lang === "java") {
          lesson.exercise.starterCode =
            'public class Main {\n    public static void main(String[] args) {\n        String prenom = "Sam";\n        \n    }\n}';
          lesson.exercise.hint = 'System.out.println("Bonjour " + prenom);';
        } else if (lang === "cpp") {
          lesson.exercise.starterCode =
            '#include <iostream>\n#include <string>\n\nint main() {\n    std::string prenom = "Sam";\n    \n    return 0;\n}';
          lesson.exercise.hint = 'std::cout << "Bonjour " << prenom << std::endl;';
        }
      }

      if (lesson.exercise.id === `${lang}-l5-ex1`) {
        lesson.exercise.validate.expected = "24";
        if (lang === "python") {
          lesson.exercise.starterCode = "x = 0\ny = 0\nprint(x * y)";
          lesson.exercise.hint = "print(x * y)";
        } else if (lang === "csharp") {
          lesson.exercise.starterCode = "int x = 0;\nint y = 0;\nConsole.WriteLine(x * y);";
          lesson.exercise.hint = "Console.WriteLine(x * y);";
        } else if (lang === "java") {
          lesson.exercise.starterCode =
            "public class Main {\n    public static void main(String[] args) {\n        int x = 0;\n        int y = 0;\n        System.out.println(x * y);\n    }\n}";
          lesson.exercise.hint = "System.out.println(x * y);";
        } else if (lang === "cpp") {
          lesson.exercise.starterCode =
            "#include <iostream>\n\nint main() {\n    int x = 0;\n    int y = 0;\n    std::cout << x * y << std::endl;\n    return 0;\n}";
          lesson.exercise.hint = "std::cout << x * y << std::endl;";
        }
      }
    }
  }

  // Marquer chapitres
  for (const level of track.levels) {
    if (level.id <= 5) level.chapter = level.chapter ?? 1;
  }

  save(lang, track);
  const n = track.levels.reduce((a, l) => a + l.lessons.length, 0);
  const ex = track.levels.reduce(
    (a, l) => a + l.lessons.filter((x) => x.exercise).length,
    0,
  );
  console.log(`${lang}: ${n} lessons, ${ex} exercises`);
}

for (const lang of ["python", "csharp", "cpp", "java"]) {
  patchTrack(lang);
}
