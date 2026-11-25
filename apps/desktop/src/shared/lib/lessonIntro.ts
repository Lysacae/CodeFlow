import type { Section } from "@/shared/lib/content";

function prose(body: string): Section {
  return { type: "prose", body };
}

function code(sample: string): Section {
  return { type: "code", code: sample };
}

/** Rappel de langage, affiché au début des leçons après le niveau 1. */
export function lessonIntro(languageId: string): Section[] {
  switch (languageId) {
    case "python":
      return [
        prose(
          "Dans ce parcours, les instructions sont du Python. L'interpréteur les lit de haut en bas, sans compilation préalable.",
        ),
        prose(
          "print(\"texte\") affiche une ligne. Les guillemets délimitent le texte. L'indentation (espaces en début de ligne) indique les blocs, par exemple sous un if.",
        ),
        code('print("Bonjour")'),
        prose(
          "Si la syntaxe est fausse, l'interpréteur s'arrête et la zone Sortie indique la ligne. Relisez les guillemets, les parenthèses et les espaces.",
        ),
      ];
    case "csharp":
      return [
        prose(
          "Dans ce parcours, les instructions sont du C#. Le SDK .NET les compile avant de lancer le programme.",
        ),
        prose(
          "Console.WriteLine(\"texte\"); affiche une ligne. Le point-virgule termine l'instruction. Les blocs sont entre accolades { }.",
        ),
        code('Console.WriteLine("Bonjour");'),
        prose(
          "Si la compilation échoue, rien ne s'exécute. Le message, souvent error CS…, cite la ligne à corriger.",
        ),
      ];
    case "java":
      return [
        prose(
          "Dans ce parcours, les instructions sont du Java, dans une classe Main. javac compile, puis la JVM exécute main.",
        ),
        prose(
          "System.out.println(\"texte\"); affiche une ligne et se termine par un point-virgule. Le nom de la classe publique doit rester Main.",
        ),
        code('System.out.println("Bonjour");'),
        prose(
          "Tant que javac signale une erreur, le programme ne démarre pas. Vérifiez le point-virgule, les guillemets et les accolades.",
        ),
      ];
    case "cpp":
      return [
        prose(
          "Dans ce parcours, les instructions sont du C++. Le compilateur produit un exécutable, puis main démarre.",
        ),
        prose(
          "std::cout << \"texte\" << std::endl; affiche une ligne. #include <iostream> fournit std::cout. Chaque instruction se termine par un point-virgule.",
        ),
        code('std::cout << "Bonjour" << std::endl;'),
        prose(
          "Si le compilateur échoue, le programme n'est pas lancé. Contrôlez les points-virgules, les accolades et l'en-tête iostream.",
        ),
      ];
    default:
      return [];
  }
}
