import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../content/tracks");

function load(lang) {
  return JSON.parse(fs.readFileSync(path.join(root, lang, "track.json"), "utf8"));
}
function save(lang, data) {
  fs.writeFileSync(path.join(root, lang, "track.json"), JSON.stringify(data, null, 2));
}

function sentenceBreak(text) {
  // Ne plus couper chaque phrase sur une ligne vide : garder des paragraphes fluides.
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

function deepenProse(sections) {
  return sections.map((s) =>
    s.type === "prose" && s.body ? { ...s, body: sentenceBreak(s.body) } : s,
  );
}

function enrichExercise(ex, extra) {
  if (!ex) return ex;
  return {
    ...ex,
    prompt: sentenceBreak(`${extra}\n\n${ex.prompt}`),
  };
}

const INT_EXPLAIN = {
  csharp:
    "`int` désigne un nombre entier.\n\nUn entier est un nombre sans virgule : 0, 1, 18, -3.\n\nOn l'utilise pour compter, mesurer un âge, un score ou une quantité.\n\nExemple : `int age = 18;` range le nombre 18 dans une case nommée age.",
  java:
    "`int` désigne un nombre entier.\n\nUn entier est un nombre sans virgule : 0, 1, 18, -3.\n\nOn l'utilise pour compter, un âge, un score ou une quantité.\n\nExemple : `int age = 18;` range le nombre 18 dans une case nommée age.",
  cpp:
    "`int` désigne un nombre entier.\n\nUn entier est un nombre sans virgule : 0, 1, 18, -3.\n\nOn l'utilise pour compter, un âge, un score ou une quantité.\n\nExemple : `int age = 18;` range le nombre 18 dans une case nommée age.",
  python:
    "En Python, un nombre écrit sans virgule est automatiquement un entier.\n\nExemple : `age = 18` range le nombre entier 18 dans la case nommée age.\n\nOn l'utilise pour compter, un score ou une quantité.",
};

function patchChapter1(track, lang) {
  for (const level of track.levels) {
    level.chapter = 1;
    for (const lesson of level.lessons) {
      lesson.sections = deepenProse(lesson.sections);

      if (lesson.id.endsWith("-l2-syntax") && lang === "csharp") {
        lesson.sections = [
          {
            type: "prose",
            body: "En C#, une instruction se termine souvent par `;`.\n\nLes blocs utilisent `{ }`.\n\nLe point-virgule indique la fin d'une instruction.\n\nLes accolades regroupent plusieurs instructions qui appartiennent ensemble, par exemple le contenu d'un `if`.",
          },
        ];
      }

      if (lesson.id.includes("-l3-types") || lesson.id.includes("-l3-declare")) {
        if (lang !== "python" || lesson.id.includes("types") || lesson.id.includes("declare")) {
          const already = lesson.sections.some((s) => s.body && s.body.includes("`int`"));
          if (!already && (lesson.id.includes("types") || lesson.title.toLowerCase().includes("type"))) {
            lesson.sections = [
              { type: "prose", body: INT_EXPLAIN[lang] },
              ...lesson.sections,
            ];
          }
        }
      }

      if (lesson.id.includes("-l3-numbers") || lesson.id.includes("-l4-conditions")) {
        lesson.sections = [
          { type: "prose", body: INT_EXPLAIN[lang] },
          ...lesson.sections.filter((s) => !(s.body && s.body.includes("`int` désigne"))),
        ];
        lesson.sections = deepenProse(lesson.sections);
      }

      if (lesson.exercise) {
        // Ne plus préfixer une consigne générique : chaque exercice a sa propre explication.
        if (!lesson.exercise.hint) {
          lesson.exercise.hint =
            "Comparez votre code avec l'exemple du cours, ligne par ligne.";
        }
      }
    }
  }
  return track;
}

function chapter2(lang, name) {
  const wrap = {
    csharp: (body) => body,
    java: (body) =>
      `public class Main {\n    public static void main(String[] args) {\n${body
        .split("\n")
        .map((l) => "        " + l)
        .join("\n")}\n    }\n}`,
    cpp: (body) =>
      `#include <iostream>\n#include <string>\n\nint main() {\n${body
        .split("\n")
        .map((l) => "    " + l)
        .join("\n")}\n    return 0;\n}`,
    python: (body) => body,
  }[lang];

  const print = {
    csharp: (s) => `Console.WriteLine("${s}");`,
    java: (s) => `System.out.println("${s}");`,
    cpp: (s) => `std::cout << "${s}" << std::endl;`,
    python: (s) => `print("${s}")`,
  }[lang];

  const levels = [
    {
      id: 6,
      chapter: 2,
      title: "Texte et formatage",
      summary: `Manipuler le texte plus précisément en ${name}.`,
      lessons: [
        {
          id: `${lang}-c2-strings`,
          title: "Revoir les chaînes de caractères",
          sections: [
            {
              type: "prose",
              body: `Une chaîne de caractères est une suite de lettres, chiffres ou symboles traités comme du texte.\n\nOn l'écrit entre guillemets.\n\nEn ${name}, vous allez composer des messages plus riches à partir de plusieurs morceaux.`,
            },
          ],
        },
        {
          id: `${lang}-c2-compose`,
          title: "Composer un message",
          sections: [
            {
              type: "prose",
              body:
                lang === "python"
                  ? "Vous pouvez coller du texte avec +.\n\nVous pouvez aussi utiliser une f-string : du texte avec des valeurs insérées entre accolades."
                  : lang === "csharp"
                    ? "Vous pouvez coller du texte avec +.\n\nVous pouvez aussi utiliser une chaîne interpolée : $\"...{valeur}...\"."
                    : "Vous pouvez afficher plusieurs morceaux les uns après les autres.\n\nChaque partie doit être du texte, ou convertie en texte si besoin.",
            },
            {
              type: "code",
              code:
                lang === "python"
                  ? 'nom = "Alex"\nprint(f"Bonjour {nom}")'
                  : lang === "csharp"
                    ? 'string nom = "Alex";\nConsole.WriteLine($"Bonjour {nom}");'
                    : lang === "java"
                      ? wrap('String nom = "Alex";\nSystem.out.println("Bonjour " + nom);')
                      : wrap('std::string nom = "Alex";\nstd::cout << "Bonjour " << nom << std::endl;'),
            },
          ],
          exercise: {
            id: `${lang}-c2-ex1`,
            prompt:
              "Objectif : afficher exactement Bonjour CodeFlow.\n\nCréez une variable qui contient CodeFlow, puis construisez le message complet.\n\nLa sortie doit être une seule ligne.",
            hint:
              lang === "python"
                ? 'Utilisez print("Bonjour " + nom) ou une f-string.'
                : lang === "csharp"
                  ? 'Utilisez Console.WriteLine("Bonjour " + nom);'
                  : "Assemblez Bonjour et la variable, puis affichez.",
            starterCode:
              lang === "python"
                ? 'nom = "CodeFlow"\n'
                : lang === "csharp"
                  ? 'string nom = "CodeFlow";\n'
                  : lang === "java"
                    ? wrap('String nom = "CodeFlow";\n')
                    : wrap('std::string nom = "CodeFlow";\n'),
            validate: { type: "stdoutEquals", expected: "Bonjour CodeFlow" },
          },
        },
        {
          id: `${lang}-c2-escape`,
          title: "Caractères spéciaux",
          sections: [
            {
              type: "prose",
              body: "Certains caractères ont un rôle spécial dans une chaîne.\n\nPour afficher un guillemet à l'intérieur d'un texte déjà entre guillemets, on utilise souvent une séquence d'échappement.\n\nL'important est que chaque chaîne ouverte soit correctement fermée.",
            },
          ],
        },
      ],
    },
    {
      id: 7,
      chapter: 2,
      title: "Décisions avancées",
      summary: "Enchaîner plusieurs conditions avec précision.",
      lessons: [
        {
          id: `${lang}-c2-else-if`,
          title: "Plusieurs cas possibles",
          sections: [
            {
              type: "prose",
              body: "Parfois deux issues ne suffisent pas.\n\nOn enchaîne alors plusieurs tests.\n\nLe programme évalue le premier test vrai, exécute son bloc, puis ignore les suivants.",
            },
            {
              type: "code",
              code:
                lang === "python"
                  ? 'n = 7\nif n < 5:\n    print("Petit")\nelif n < 10:\n    print("Moyen")\nelse:\n    print("Grand")'
                  : lang === "csharp"
                    ? 'int n = 7;\nif (n < 5)\n{\n    Console.WriteLine("Petit");\n}\nelse if (n < 10)\n{\n    Console.WriteLine("Moyen");\n}\nelse\n{\n    Console.WriteLine("Grand");\n}'
                    : lang === "java"
                      ? wrap(
                          'int n = 7;\nif (n < 5) {\n    System.out.println("Petit");\n} else if (n < 10) {\n    System.out.println("Moyen");\n} else {\n    System.out.println("Grand");\n}',
                        )
                      : wrap(
                          'int n = 7;\nif (n < 5) {\n    std::cout << "Petit" << std::endl;\n} else if (n < 10) {\n    std::cout << "Moyen" << std::endl;\n} else {\n    std::cout << "Grand" << std::endl;\n}',
                        ),
            },
          ],
          exercise: {
            id: `${lang}-c2-ex2`,
            prompt:
              "La variable note vaut 14.\n\nSi note < 10, affichez Insuffisant.\n\nSinon si note < 14, affichez Passable.\n\nSinon affichez Bien.\n\nAvec note = 14, la sortie attendue est Bien.",
            hint: "Le troisième cas (else) doit s'exécuter ici.",
            starterCode:
              lang === "python"
                ? "note = 14\n"
                : lang === "csharp"
                  ? "int note = 14;\n"
                  : lang === "java"
                    ? wrap("int note = 14;\n")
                    : wrap("int note = 14;\n"),
            validate: { type: "stdoutEquals", expected: "Bien" },
          },
        },
        {
          id: `${lang}-c2-and-or`,
          title: "Combiner des tests",
          sections: [
            {
              type: "prose",
              body:
                lang === "python"
                  ? "Vous pouvez combiner des tests avec `and` (les deux doivent être vrais) et `or` (au moins un doit être vrai)."
                  : "Vous pouvez combiner des tests avec `&&` (les deux doivent être vrais) et `||` (au moins un doit être vrai).",
            },
          ],
        },
      ],
    },
    {
      id: 8,
      chapter: 2,
      title: "Boucles utiles",
      summary: "Répéter sans recopier le même code.",
      lessons: [
        {
          id: `${lang}-c2-for`,
          title: "Parcourir une plage",
          sections: [
            {
              type: "prose",
              body: "Une boucle répète un bloc tant qu'une règle de progression est vraie.\n\nElle évite de dupliquer les mêmes instructions.",
            },
          ],
          exercise: {
            id: `${lang}-c2-ex3`,
            prompt:
              "Affichez les nombres 1, 2 et 3, chacun sur sa ligne.\n\nUtilisez une boucle plutôt que trois affichages copiés à la main.",
            hint:
              lang === "python"
                ? "for i in range(1, 4): print(i)"
                : "Une boucle de 1 à 3 inclus.",
            starterCode:
              lang === "python"
                ? ""
                : lang === "csharp"
                  ? ""
                  : lang === "java"
                    ? wrap("")
                    : wrap(""),
            validate: { type: "stdoutEquals", expected: "1\n2\n3" },
          },
        },
        {
          id: `${lang}-c2-accumulate`,
          title: "Accumuler une valeur",
          sections: [
            {
              type: "prose",
              body: "On peut faire évoluer une variable à chaque tour de boucle.\n\nExemple classique : partir de 0, puis ajouter 1 à chaque passage.",
            },
          ],
        },
      ],
    },
    {
      id: 9,
      chapter: 2,
      title: lang === "python" ? "Listes" : lang === "csharp" ? "Tableaux et listes" : "Tableaux",
      summary: "Ranger plusieurs valeurs sous un même nom.",
      lessons: [
        {
          id: `${lang}-c2-collections`,
          title: "Stocker plusieurs valeurs",
          sections: [
            {
              type: "prose",
              body:
                lang === "python"
                  ? "Une liste regroupe plusieurs valeurs dans l'ordre.\n\nExemple : `nombres = [2, 4, 6]`.\n\nOn accède au premier élément avec l'index 0."
                  : lang === "csharp"
                    ? "Un tableau ou une liste regroupe plusieurs valeurs.\n\nExemple : `int[] nombres = {2, 4, 6};`.\n\nL'index 0 désigne le premier élément."
                    : "Un tableau regroupe plusieurs valeurs du même type.\n\nL'index 0 désigne le premier élément.",
            },
          ],
          exercise: {
            id: `${lang}-c2-ex4`,
            prompt:
              "Créez une collection contenant 10 puis 20.\n\nAffichez uniquement la première valeur.\n\nLa sortie attendue est 10.",
            hint: "Utilisez l'index 0.",
            starterCode:
              lang === "python"
                ? "valeurs = [10, 20]\n"
                : lang === "csharp"
                  ? "int[] valeurs = {10, 20};\n"
                  : lang === "java"
                    ? wrap("int[] valeurs = {10, 20};\n")
                    : wrap("int valeurs[2] = {10, 20};\n"),
            validate: { type: "stdoutEquals", expected: "10" },
          },
        },
      ],
    },
    {
      id: 10,
      chapter: 2,
      title: "Fonctions",
      summary: "Découper un programme en actions réutilisables.",
      lessons: [
        {
          id: `${lang}-c2-functions`,
          title: "Créer une action nommée",
          sections: [
            {
              type: "prose",
              body:
                lang === "python"
                  ? "Une fonction regroupe des instructions sous un nom.\n\nOn la définit avec `def`, puis on l'appelle par son nom suivi de parenthèses."
                  : "Une méthode ou fonction regroupe des instructions sous un nom.\n\nOn la déclare, puis on l'appelle pour exécuter son contenu.",
            },
          ],
          exercise: {
            id: `${lang}-c2-ex5`,
            prompt:
              `Affichez exactement Pret.\n\nVous pouvez le faire avec une fonction simple, ou directement.\n\nL'important est la sortie finale.`,
            hint: print("Pret"),
            starterCode:
              lang === "python"
                ? ""
                : lang === "csharp"
                  ? ""
                  : wrap(""),
            validate: { type: "stdoutEquals", expected: "Pret" },
          },
        },
        {
          id: `${lang}-c2-project`,
          title: "Mini-projet : diagnostic",
          sections: [
            {
              type: "prose",
              body: "Combinez variable, condition et affichage.\n\nC'est le même raisonnement que dans le chapitre 1, avec un objectif un peu plus long.",
            },
          ],
          exercise: {
            id: `${lang}-c2-ex6`,
            prompt:
              "La variable charge vaut 85.\n\nSi charge >= 80, affichez Niveau eleve.\n\nSinon affichez Niveau normal.\n\nAvec 85, la sortie attendue est Niveau eleve.",
            hint: "Un if suffit.",
            starterCode:
              lang === "python"
                ? "charge = 85\n"
                : lang === "csharp"
                  ? "int charge = 85;\n"
                  : wrap("int charge = 85;\n"),
            validate: { type: "stdoutEquals", expected: "Niveau eleve" },
          },
        },
      ],
    },
  ];

  return levels;
}

for (const lang of ["python", "csharp", "cpp", "java"]) {
  let track = load(lang);
  track = patchChapter1(track, lang);
  // remove existing chapter 2 if re-run
  track.levels = track.levels.filter((l) => (l.chapter ?? 1) === 1);
  const names = { python: "Python", csharp: "C#", cpp: "C++", java: "Java" };
  track.levels.push(...chapter2(lang, names[lang]));
  save(lang, track);
  const n = track.levels.reduce((a, l) => a + l.lessons.length, 0);
  console.log(`${lang}: ${track.levels.length} levels, ${n} lessons`);
}
