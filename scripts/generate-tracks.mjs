import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../content/tracks");

const prose = (...paras) => paras.map((body) => ({ type: "prose", body }));
const code = (c) => ({ type: "code", code: c });
const ex = (id, prompt, hint, starterCode, expected) => ({
  id,
  prompt,
  hint,
  starterCode,
  validate: { type: "stdoutEquals", expected },
});

function writeTrack(lang, levels) {
  const file = path.join(root, lang, "track.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ language: lang, levels }, null, 2));
  const n = levels.reduce((a, l) => a + l.lessons.length, 0);
  console.log(`${lang}: ${n} lessons`);
}

writeTrack("python", [
  {
    id: 1,
    title: "Découverte",
    summary: "Comprendre ce qu'est un programme, sans jargon inutile.",
    lessons: [
      {
        id: "python-l1-what-is-programming",
        title: "Qu'est-ce que la programmation ?",
        sections: prose(
          "Programmer, c'est écrire des ordres très précis pour un ordinateur. Ces ordres s'appellent des instructions. Quand on regroupe plusieurs instructions, on obtient un programme.",
          "Un ordinateur ne « comprend » pas une intention vague. Il fait uniquement ce qui est écrit. Si une instruction est incomplète ou mal orthographiée, le programme s'arrête ou affiche une erreur.",
          "L'objectif de CodeFlow est de vous apprendre à écrire ces instructions progressivement, en commençant par les plus simples.",
        ),
      },
      {
        id: "python-l1-why-python",
        title: "Pourquoi apprendre Python ?",
        sections: prose(
          "Python est un langage de programmation : un ensemble de règles pour écrire des instructions. On le choisit souvent pour débuter car son écriture reste lisible.",
          "On utilise Python pour automatiser des tâches, analyser des données, créer des petits outils, ou apprendre les bases avant d'autres langages.",
          "Dans CodeFlow, Python sert de premier terrain d'entraînement : peu de lignes, un résultat visible rapidement.",
        ),
      },
      {
        id: "python-l1-how-program-works",
        title: "Comment un programme s'exécute",
        sections: prose(
          "Quand vous cliquez sur Exécuter, CodeFlow envoie votre texte à un programme appelé interpréteur Python. L'interpréteur lit chaque ligne, dans l'ordre, du haut vers le bas.",
          "Si une ligne est correcte, elle produit une action (par exemple afficher un message). Si une ligne est incorrecte, l'interpréteur s'arrête et explique l'erreur.",
          "La zone Sortie, sous l'éditeur, montre exactement ce que le programme a affiché. Ce n'est pas une simulation : c'est le vrai résultat.",
        ),
      },
      {
        id: "python-l1-source-code",
        title: "Qu'est-ce que le code source ?",
        sections: [
          ...prose(
            "Le code source est le texte que vous tapez. Ce texte doit respecter la grammaire de Python. Cette grammaire s'appelle la syntaxe.",
            "En Python, les espaces en début de ligne (indentation) font partie des règles. Pour l'instant, vos programmes tiendront sur peu de lignes.",
            "Exemple minimal :",
          ),
          code('print("Exemple de code source")'),
          ...prose(
            "Cette ligne demande à Python d'afficher le texte placé entre guillemets.",
          ),
        ],
      },
      {
        id: "python-l1-editor",
        title: "Utiliser l'éditeur CodeFlow",
        sections: prose(
          "L'éditeur colorie le code pour faciliter la lecture. Les numéros à gauche indiquent la ligne. Cela aide à retrouver une erreur.",
          "Le bouton Exécuter lance le programme. Le bouton Réinitialiser remet le code de départ. La zone Sortie affiche le résultat ou le message d'erreur.",
          "Prenez l'habitude de lire la sortie après chaque essai. C'est le moyen le plus fiable de vérifier ce que fait réellement le programme.",
        ),
      },
      {
        id: "python-l1-errors",
        title: "Lire un message d'erreur",
        sections: prose(
          "Une erreur n'est pas un échec définitif. C'est une information : Python indique qu'une règle n'a pas été respectée.",
          "Souvent, le message cite un numéro de ligne. Relisez cette ligne en priorité : guillemets manquants, parenthèse oubliée, nom mal orthographié.",
        ),
      },
    ],
  },
  {
    id: 2,
    title: "Premier programme",
    summary: "Afficher du texte, commenter, créer un fichier.",
    lessons: [
      {
        id: "python-l2-print",
        title: "Afficher du texte",
        sections: [
          ...prose(
            "Un programme est une suite d'instructions que l'ordinateur exécute. Nous allons commencer par lui demander d'afficher un message.",
            "En Python, l'instruction print sert à afficher. On écrit print, puis des parenthèses. À l'intérieur, on place le texte entre guillemets.",
            "Les guillemets marquent le début et la fin du message. Sans guillemets, Python croirait que le mot est un nom de variable.",
          ),
          code('print("Bonjour !")'),
        ],
        exercise: ex(
          "python-l2-ex1",
          "Modifie le programme pour qu'il affiche Bienvenue dans la programmation !",
          "Change uniquement le texte entre les guillemets.",
          'print("Bonjour !")',
          "Bienvenue dans la programmation !",
        ),
      },
      {
        id: "python-l2-several-prints",
        title: "Afficher plusieurs lignes",
        sections: [
          ...prose(
            "Chaque print affiche une ligne, puis passe à la suivante. L'ordre d'écriture est l'ordre d'exécution.",
          ),
          code('print("Ligne 1")\nprint("Ligne 2")'),
        ],
        exercise: ex(
          "python-l2-ex2",
          "Affiche CodeFlow puis Python, chacun sur sa ligne.",
          "Deux instructions print.",
          'print("")\nprint("")',
          "CodeFlow\nPython",
        ),
      },
      {
        id: "python-l2-comments",
        title: "Les commentaires",
        sections: [
          ...prose(
            "Un commentaire est une note pour l'humain. Python l'ignore. Il commence par #.",
          ),
          code('# Note pour le lecteur\nprint("Bonjour !")'),
        ],
      },
      {
        id: "python-l2-quotes",
        title: "Guillemets et texte",
        sections: [
          ...prose(
            "Le texte affiché s'appelle une chaîne de caractères. On l'écrit entre guillemets \"...\" ou '...'.",
          ),
          code("print(\"Texte\")\nprint('Autre texte')"),
        ],
      },
      {
        id: "python-l2-first-file",
        title: "Créer ton premier fichier",
        kind: "file-wizard",
        sections: prose(
          "Un fichier .py conserve votre programme sur l'ordinateur. Vous choisirez l'emplacement d'enregistrement.",
        ),
        fileWizard: {
          defaultName: "bonjour",
          extension: ".py",
          starterCode: 'print("Bonjour")',
          notes: [
            "Choisissez le dossier via la fenêtre d'enregistrement.",
            "L'extension .py identifie un fichier Python.",
          ],
        },
      },
    ],
  },
  {
    id: 3,
    title: "Variables",
    summary: "Stocker, réutiliser et modifier des informations.",
    lessons: [
      {
        id: "python-l3-declare",
        title: "Déclarer une variable",
        sections: [
          ...prose(
            "Une variable est un espace nommé dans lequel un programme peut stocker une valeur. Cette valeur peut être utilisée, modifiée ou remplacée.",
            "On crée une variable avec un nom, le signe =, puis une valeur. Ici, = signifie « ranger », pas une égalité mathématique.",
          ),
          code('message = "Bonjour"\nprint(message)'),
        ],
        exercise: ex(
          "python-l3-ex1",
          'Crée une variable ville contenant "Paris", puis affiche-la.',
          'ville = "Paris" puis print(ville)',
          'ville = ""\nprint(ville)',
          "Paris",
        ),
      },
      {
        id: "python-l3-names",
        title: "Nommer une variable",
        sections: prose(
          "Un nom commence par une lettre ou _. Pas d'espaces, pas d'accents. score et Score sont différents.",
        ),
      },
      {
        id: "python-l3-types",
        title: "Les types de base",
        sections: [
          ...prose(
            "Types courants : texte (str), entier (int), décimal (float), booléen True/False.",
          ),
          code('age = 20\nnom = "Alex"\nprint(age)\nprint(nom)'),
        ],
      },
      {
        id: "python-l3-modify",
        title: "Modifier une valeur",
        sections: [
          ...prose("Une variable peut recevoir une nouvelle valeur. L'ancienne est remplacée."),
          code("compteur = 1\nprint(compteur)\ncompteur = 2\nprint(compteur)"),
        ],
        exercise: ex(
          "python-l3-ex2",
          "Crée score = 0, remplace par 10, puis affiche score.",
          "Deux affectations puis print(score).",
          "score = 0\n",
          "10",
        ),
      },
      {
        id: "python-l3-concat",
        title: "Assembler du texte",
        sections: [
          ...prose("Le + colle deux textes (concaténation)."),
          code('prenom = "Lea"\nprint("Bonjour " + prenom)'),
        ],
        exercise: ex(
          "python-l3-ex3",
          'Avec prenom = "Sam", affichez Bonjour Sam',
          'print("Bonjour " + prenom)',
          'prenom = "Sam"\n',
          "Bonjour Sam",
        ),
      },
      {
        id: "python-l3-numbers",
        title: "Calculer avec des nombres",
        sections: [
          ...prose("Opérateurs : + - * /"),
          code("a = 4\nb = 2\nprint(a + b)"),
        ],
        exercise: ex(
          "python-l3-ex4",
          "Stocke 7 dans a, 3 dans b, affiche leur somme.",
          "print(a + b)",
          "a = 0\nb = 0\nprint(a + b)",
          "10",
        ),
      },
    ],
  },
  {
    id: 4,
    title: "Logique",
    summary: "Conditions, comparaisons et boucles.",
    lessons: [
      {
        id: "python-l4-conditions",
        title: "Les conditions if",
        sections: [
          ...prose(
            "if exécute un bloc seulement si un test est vrai. Les lignes du bloc sont indentées.",
          ),
          code('age = 18\nif age >= 18:\n    print("Majeur")'),
        ],
        exercise: ex(
          "python-l4-ex1",
          "Si score >= 10, affiche Réussi.",
          "if score >= 10: print(\"Réussi\")",
          "score = 12\n",
          "Réussi",
        ),
      },
      {
        id: "python-l4-else",
        title: "if et else",
        sections: [
          ...prose("else couvre le cas contraire."),
          code('n = 3\nif n > 5:\n    print("Grand")\nelse:\n    print("Petit")'),
        ],
        exercise: ex(
          "python-l4-ex2",
          "Avec temperature = 5, affiche Froid si temperature < 10, sinon Doux.",
          "Le résultat attendu est Froid.",
          "temperature = 5\n",
          "Froid",
        ),
      },
      {
        id: "python-l4-operators",
        title: "Comparaisons",
        sections: prose(
          "== compare l'égalité. = range une valeur. != < > <= >= comparent aussi.",
        ),
      },
      {
        id: "python-l4-loops",
        title: "Boucle for",
        sections: [
          ...prose("for i in range(3): répète avec i = 0, 1, 2."),
          code("for i in range(3):\n    print(i)"),
        ],
        exercise: ex(
          "python-l4-ex3",
          "Affiche 0 puis 1 puis 2 avec for et range(3).",
          "for i in range(3): print(i)",
          "",
          "0\n1\n2",
        ),
      },
      {
        id: "python-l4-while",
        title: "Boucle while",
        sections: [
          ...prose(
            "while répète tant qu'une condition est vraie. Faites évoluer la variable du test.",
          ),
          code("n = 0\nwhile n < 3:\n    print(n)\n    n = n + 1"),
        ],
      },
    ],
  },
  {
    id: 5,
    title: "Premiers exercices",
    summary: "Combiner variables, conditions et corrections.",
    lessons: [
      {
        id: "python-l5-combine",
        title: "Multiplier deux nombres",
        sections: prose(
          "Vous combinez deux variables numériques et un opérateur. Cette fois, c'est un produit (*).",
        ),
        exercise: ex(
          "python-l5-ex1",
          "x = 4, y = 6, affichez le produit (24).",
          "print(x * y)",
          "x = 0\ny = 0\nprint(x * y)",
          "24",
        ),
      },
      {
        id: "python-l5-fix",
        title: "Corriger une erreur",
        sections: prose("Corrigez le programme pour afficher CodeFlow."),
        exercise: ex(
          "python-l5-ex2",
          "Corrige le programme pour qu'il affiche CodeFlow.",
          "Guillemets incomplets.",
          'print(CodeFlow")',
          "CodeFlow",
        ),
      },
      {
        id: "python-l5-mini",
        title: "Mini-programme : salutation",
        sections: prose("Assemblez un message à partir d'une variable."),
        exercise: ex(
          "python-l5-ex3",
          'Crée nom = "Alex" puis affiche Bonjour Alex',
          'print("Bonjour " + nom)',
          'nom = "Alex"\n',
          "Bonjour Alex",
        ),
      },
      {
        id: "python-l5-decision",
        title: "Mini-programme : décision",
        sections: prose("Utilisez une condition pour choisir le message."),
        exercise: ex(
          "python-l5-ex4",
          "Avec points = 15, affiche Validé si points >= 10.",
          'if points >= 10: print("Validé")',
          "points = 15\n",
          "Validé",
        ),
      },
    ],
  },
]);

function langTrack(lang, name, ext, printExpr, hello, welcome, wrap = (c) => c, fileNotes = []) {
  const show = (msg) => wrap(printExpr(msg));
  return [
    {
      id: 1,
      title: "Découverte",
      summary: `Comprendre la programmation et le rôle de ${name}.`,
      lessons: [
        {
          id: `${lang}-l1-what-is-programming`,
          title: "Qu'est-ce que la programmation ?",
          sections: prose(
            "Programmer, c'est donner à l'ordinateur une liste d'ordres précis, appelés instructions. Un programme est cette liste.",
            "L'ordinateur n'improvise pas. Il applique ce qui est écrit. Une faute de frappe peut empêcher l'exécution.",
          ),
        },
        {
          id: `${lang}-l1-why`,
          title: `À quoi sert ${name} ?`,
          sections: prose(
            `${name} est un langage de programmation : un vocabulaire et une grammaire pour écrire des instructions.`,
            lang === "csharp"
              ? "C# est souvent utilisé avec .NET pour créer des applications Windows, des services web et des outils professionnels."
              : lang === "cpp"
                ? "C++ sert surtout quand on a besoin de performance : logiciels, jeux, outils système."
                : "Java sert à construire des applications robustes qui peuvent tourner sur différents systèmes grâce à la JVM.",
            "Dans CodeFlow, vous apprendrez d'abord les gestes essentiels : afficher, stocker, décider, répéter.",
          ),
        },
        {
          id: `${lang}-l1-how`,
          title: "Comment un programme s'exécute",
          sections: prose(
            lang === "csharp" || lang === "cpp" || lang === "java"
              ? "Avant d'exécuter, le code est souvent compilé : transformé en une forme exécutable. Si la compilation échoue, le programme ne démarre pas."
              : "Le programme est lu puis exécuté ligne par ligne.",
            "La zone Sortie de CodeFlow affiche le résultat réel. Aucune fenêtre cmd externe n'est nécessaire.",
          ),
        },
        {
          id: `${lang}-l1-source`,
          title: "Lire du code source",
          sections: [
            ...prose(
              "Le code source est le texte que vous écrivez. Chaque symbole compte : parenthèses, guillemets, et selon le langage points-virgules ou accolades.",
            ),
            code(show("Exemple")),
          ],
        },
        {
          id: `${lang}-l1-editor`,
          title: "Utiliser l'éditeur",
          sections: prose(
            "Exécuter lance vraiment votre programme. Réinitialiser restaure le départ. La Sortie montre le résultat ou l'erreur.",
          ),
        },
        {
          id: `${lang}-l1-errors`,
          title: "Comprendre une erreur",
          sections: prose(
            "Un message d'erreur indique qu'une règle du langage n'est pas respectée. Lisez la ligne citée, puis corrigez un détail à la fois.",
          ),
        },
      ],
    },
    {
      id: 2,
      title: "Premier programme",
      summary: "Afficher du texte et créer un fichier.",
      lessons: [
        {
          id: `${lang}-l2-print`,
          title: "Afficher du texte",
          sections: [
            ...prose(
              "Un programme est une suite d'instructions. Commençons par afficher un message.",
              lang === "csharp"
                ? "Console.WriteLine écrit une ligne dans la sortie. Le texte est entre guillemets. L'instruction se termine par un point-virgule."
                : lang === "cpp"
                  ? "std::cout envoie du texte vers la sortie. << ajoute le contenu. std::endl termine la ligne."
                  : "System.out.println affiche une ligne. Le point d'entrée est la méthode main.",
            ),
            code(show(hello)),
          ],
          exercise: ex(
            `${lang}-l2-ex1`,
            `Modifie le programme pour qu'il affiche ${welcome}`,
            "Remplace uniquement le texte entre guillemets.",
            show(hello),
            welcome,
          ),
        },
        {
          id: `${lang}-l2-lines`,
          title: "Plusieurs messages",
          sections: [
            ...prose("Deux instructions d'affichage produisent deux lignes."),
            code(
              lang === "csharp"
                ? 'Console.WriteLine("Ligne 1");\nConsole.WriteLine("Ligne 2");'
                : lang === "cpp"
                  ? '#include <iostream>\n\nint main() {\n    std::cout << "Ligne 1" << std::endl;\n    std::cout << "Ligne 2" << std::endl;\n    return 0;\n}'
                  : 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Ligne 1");\n        System.out.println("Ligne 2");\n    }\n}',
            ),
          ],
          exercise: ex(
            `${lang}-l2-ex2`,
            "Affiche CodeFlow puis " + name + ", chacun sur sa ligne.",
            "Deux instructions d'affichage.",
            lang === "csharp"
              ? 'Console.WriteLine("");\nConsole.WriteLine("");'
              : lang === "cpp"
                ? '#include <iostream>\n\nint main() {\n    std::cout << "" << std::endl;\n    std::cout << "" << std::endl;\n    return 0;\n}'
                : 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("");\n        System.out.println("");\n    }\n}',
            `CodeFlow\n${name}`,
          ),
        },
        {
          id: `${lang}-l2-comments`,
          title: "Les commentaires",
          sections: [
            ...prose(
              "Un commentaire documente le code sans être exécuté. Ici, il commence par //.",
            ),
            code(
              (lang === "cpp"
                ? "#include <iostream>\n\nint main() {\n    // Affiche un message\n    std::cout << \"Bonjour !\" << std::endl;\n    return 0;\n}"
                : lang === "java"
                  ? "public class Main {\n    public static void main(String[] args) {\n        // Affiche un message\n        System.out.println(\"Bonjour !\");\n    }\n}"
                  : "// Affiche un message\nConsole.WriteLine(\"Bonjour !\");"),
            ),
          ],
        },
        {
          id: `${lang}-l2-syntax`,
          title: "Les règles d'écriture essentielles",
          sections: prose(
            lang === "csharp"
              ? "En C#, une instruction se termine souvent par `;`.\n\nLes blocs utilisent `{ }`.\n\nLe point-virgule marque la fin d'une instruction.\n\nLes accolades regroupent les instructions d'un même bloc."
              : lang === "cpp"
                ? "`main` est le point d'entrée du programme.\n\n`return 0;` signale une fin normale."
                : "En Java, une classe publique et son fichier portent le même nom.\n\nExemple : la classe `Main` se trouve dans `Main.java`.",
          ),
        },
        {
          id: `${lang}-l2-first-file`,
          title: "Créer ton premier fichier",
          kind: "file-wizard",
          sections: prose(
            `Un fichier ${ext} conserve votre programme. Vous choisirez l'emplacement sur votre ordinateur.`,
            lang === "java"
              ? "Si la classe s'appelle Main, le fichier doit s'appeler Main.java."
              : "Donnez un nom clair, sans espaces.",
          ),
          fileWizard: {
            defaultName: lang === "java" ? "Main" : lang === "csharp" ? "Bonjour" : "bonjour",
            extension: ext,
            starterCode: show(hello),
            requireClassNameMatch: lang === "java",
            notes: fileNotes,
          },
        },
      ],
    },
    {
      id: 3,
      title: "Variables",
      summary: "Stocker et réutiliser des informations.",
      lessons: [
        {
          id: `${lang}-l3-declare`,
          title: "Déclarer une variable",
          sections: [
            ...prose(
              "Une variable est un espace nommé qui stocke une valeur. On lui donne un nom pour la réutiliser.",
              lang === "csharp"
                ? 'En C#, on précise souvent le type : string message = "Bonjour";'
                : lang === "cpp"
                  ? 'En C++, on précise le type : std::string message = "Bonjour";'
                  : 'En Java : String message = "Bonjour";',
            ),
            code(
              lang === "csharp"
                ? 'string message = "Bonjour";\nConsole.WriteLine(message);'
                : lang === "cpp"
                  ? '#include <iostream>\n#include <string>\n\nint main() {\n    std::string message = "Bonjour";\n    std::cout << message << std::endl;\n    return 0;\n}'
                  : 'public class Main {\n    public static void main(String[] args) {\n        String message = "Bonjour";\n        System.out.println(message);\n    }\n}',
            ),
          ],
          exercise: ex(
            `${lang}-l3-ex1`,
            'Crée une variable ville = "Paris" puis affiche-la.',
            "Affectez Paris puis affichez la variable.",
            lang === "csharp"
              ? 'string ville = "";\nConsole.WriteLine(ville);'
              : lang === "cpp"
                ? '#include <iostream>\n#include <string>\n\nint main() {\n    std::string ville = "";\n    std::cout << ville << std::endl;\n    return 0;\n}'
                : 'public class Main {\n    public static void main(String[] args) {\n        String ville = "";\n        System.out.println(ville);\n    }\n}',
            "Paris",
          ),
        },
        {
          id: `${lang}-l3-types`,
          title: "Types de données",
          sections: prose(
            "Le type décrit la nature de la valeur : texte, entier, décimal, vrai/faux. Il limite les opérations possibles.",
          ),
        },
        {
          id: `${lang}-l3-modify`,
          title: "Modifier une variable",
          sections: prose(
            "On peut remplacer la valeur d'une variable. Le nom reste identique ; seule l'information change.",
          ),
        },
        {
          id: `${lang}-l3-numbers`,
          title: "Nombres et calculs",
          sections: [
            ...prose("Les opérateurs + - * / calculent à partir de nombres."),
            code(
              lang === "csharp"
                ? "int a = 7;\nint b = 3;\nConsole.WriteLine(a + b);"
                : lang === "cpp"
                  ? "#include <iostream>\n\nint main() {\n    int a = 7;\n    int b = 3;\n    std::cout << (a + b) << std::endl;\n    return 0;\n}"
                  : "public class Main {\n    public static void main(String[] args) {\n        int a = 7;\n        int b = 3;\n        System.out.println(a + b);\n    }\n}",
            ),
          ],
          exercise: ex(
            `${lang}-l3-ex2`,
            "Affiche la somme de 7 et 3.",
            "Utilisez deux variables puis affichez a + b.",
            lang === "csharp"
              ? "int a = 0;\nint b = 0;\nConsole.WriteLine(a + b);"
              : lang === "cpp"
                ? "#include <iostream>\n\nint main() {\n    int a = 0;\n    int b = 0;\n    std::cout << (a + b) << std::endl;\n    return 0;\n}"
                : "public class Main {\n    public static void main(String[] args) {\n        int a = 0;\n        int b = 0;\n        System.out.println(a + b);\n    }\n}",
            "10",
          ),
        },
      ],
    },
    {
      id: 4,
      title: "Logique",
      summary: "Conditions et répétitions.",
      lessons: [
        {
          id: `${lang}-l4-conditions`,
          title: "Conditions",
          sections: [
            ...prose(
              "Une condition if exécute un bloc seulement si un test est vrai.",
            ),
            code(
              lang === "csharp"
                ? 'int age = 18;\nif (age >= 18)\n{\n    Console.WriteLine("Majeur");\n}'
                : lang === "cpp"
                  ? '#include <iostream>\n\nint main() {\n    int age = 18;\n    if (age >= 18) {\n        std::cout << "Majeur" << std::endl;\n    }\n    return 0;\n}'
                  : 'public class Main {\n    public static void main(String[] args) {\n        int age = 18;\n        if (age >= 18) {\n            System.out.println("Majeur");\n        }\n    }\n}',
            ),
          ],
          exercise: ex(
            `${lang}-l4-ex1`,
            "Si score vaut 12, affiche Réussi lorsque score >= 10.",
            "Écrivez un if puis l'affichage.",
            lang === "csharp"
              ? "int score = 12;\n"
              : lang === "cpp"
                ? "#include <iostream>\n\nint main() {\n    int score = 12;\n    \n    return 0;\n}"
                : "public class Main {\n    public static void main(String[] args) {\n        int score = 12;\n        \n    }\n}",
            "Réussi",
          ),
        },
        {
          id: `${lang}-l4-else`,
          title: "À quoi sert else ?",
          sections: [
            ...prose(
              "if traite le cas « oui ». else traite le cas « non ». Ensemble, ils couvrent les deux possibilités.",
              "Sans else, le programme reste silencieux quand le test est faux.",
            ),
            code(
              lang === "csharp"
                ? 'int n = 3;\nif (n > 5)\n{\n    Console.WriteLine("Grand");\n}\nelse\n{\n    Console.WriteLine("Petit");\n}'
                : lang === "cpp"
                  ? '#include <iostream>\n\nint main() {\n    int n = 3;\n    if (n > 5) {\n        std::cout << "Grand" << std::endl;\n    } else {\n        std::cout << "Petit" << std::endl;\n    }\n    return 0;\n}'
                  : 'public class Main {\n    public static void main(String[] args) {\n        int n = 3;\n        if (n > 5) {\n            System.out.println("Grand");\n        } else {\n            System.out.println("Petit");\n        }\n    }\n}',
            ),
          ],
          exercise: ex(
            `${lang}-l4-ex2`,
            "Avec temperature = 5, affichez Froid si < 10, sinon Doux.",
            "Écrivez if … else …",
            lang === "csharp"
              ? "int temperature = 5;\n"
              : lang === "cpp"
                ? "#include <iostream>\n\nint main() {\n    int temperature = 5;\n    \n    return 0;\n}"
                : "public class Main {\n    public static void main(String[] args) {\n        int temperature = 5;\n        \n    }\n}",
            "Froid",
          ),
        },
        {
          id: `${lang}-l4-compare`,
          title: "Comparer des valeurs",
          sections: prose(
            "== teste l'égalité. = affecte. < > <= >= comparent des nombres.",
          ),
        },
        {
          id: `${lang}-l4-loops`,
          title: "Introduction aux boucles",
          sections: prose(
            "Une boucle répète un bloc. Elle évite de copier la même instruction plusieurs fois.",
          ),
        },
      ],
    },
    {
      id: 5,
      title: "Premiers exercices",
      summary: "Appliquer les bases sur de petits programmes.",
      lessons: [
        {
          id: `${lang}-l5-combine`,
          title: "Multiplier deux nombres",
          sections: prose(
            "Combinez deux variables avec un produit (*), pas une somme.",
          ),
          exercise: ex(
            `${lang}-l5-ex1`,
            "x = 4, y = 6, affichez le produit (24).",
            "Déclarez x et y puis affichez x * y.",
            lang === "csharp"
              ? "int x = 0;\nint y = 0;\nConsole.WriteLine(x * y);"
              : lang === "cpp"
                ? "#include <iostream>\n\nint main() {\n    int x = 0;\n    int y = 0;\n    std::cout << (x * y) << std::endl;\n    return 0;\n}"
                : "public class Main {\n    public static void main(String[] args) {\n        int x = 0;\n        int y = 0;\n        System.out.println(x * y);\n    }\n}",
            "24",
          ),
        },
        {
          id: `${lang}-l5-fix`,
          title: "Corriger une erreur",
          sections: prose("Repérez l'erreur et obtenez la sortie CodeFlow."),
          exercise: ex(
            `${lang}-l5-ex2`,
            "Corrigez pour afficher CodeFlow.",
            "Il manque un guillemet ouvrant.",
            lang === "csharp"
              ? 'Console.WriteLine(CodeFlow");'
              : lang === "cpp"
                ? '#include <iostream>\n\nint main() {\n    std::cout << CodeFlow" << std::endl;\n    return 0;\n}'
                : 'public class Main {\n    public static void main(String[] args) {\n        System.out.println(CodeFlow");\n    }\n}',
            "CodeFlow",
          ),
        },
        {
          id: `${lang}-l5-decision`,
          title: "Petite décision",
          sections: prose("Utilisez une condition simple."),
          exercise: ex(
            `${lang}-l5-ex3`,
            "Avec points = 15, affiche Validé si points >= 10.",
            "Écrivez un if.",
            lang === "csharp"
              ? "int points = 15;\n"
              : lang === "cpp"
                ? "#include <iostream>\n\nint main() {\n    int points = 15;\n    \n    return 0;\n}"
                : "public class Main {\n    public static void main(String[] args) {\n        int points = 15;\n        \n    }\n}",
            "Validé",
          ),
        },
      ],
    },
  ];
}

writeTrack(
  "csharp",
  langTrack(
    "csharp",
    "C#",
    ".cs",
    (m) => `Console.WriteLine("${m}");`,
    "Bonjour !",
    "Bienvenue dans la programmation !",
    (c) => c,
    [
      "Choisissez l'emplacement via la fenêtre d'enregistrement.",
      "L'extension .cs identifie un fichier C#.",
    ],
  ),
);

writeTrack(
  "cpp",
  langTrack(
    "cpp",
    "C++",
    ".cpp",
    (m) => `std::cout << "${m}" << std::endl;`,
    "Bonjour !",
    "Bienvenue dans la programmation !",
    (inner) =>
      `#include <iostream>\n\nint main() {\n    ${inner}\n    return 0;\n}`,
    [
      "Choisissez l'emplacement via la fenêtre d'enregistrement.",
      "L'extension .cpp identifie un fichier C++.",
    ],
  ),
);

writeTrack(
  "java",
  langTrack(
    "java",
    "Java",
    ".java",
    (m) => `System.out.println("${m}");`,
    "Bonjour !",
    "Bienvenue dans la programmation !",
    (inner) =>
      `public class Main {\n    public static void main(String[] args) {\n        ${inner}\n    }\n}`,
    [
      "Pour une classe publique Main, le fichier doit être Main.java.",
      "Choisissez l'emplacement via la fenêtre d'enregistrement.",
    ],
  ),
);
