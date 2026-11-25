import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../content/tracks");

for (const lang of ["csharp", "cpp", "java"]) {
  const file = path.join(root, lang, "track.json");
  const track = JSON.parse(fs.readFileSync(file, "utf8"));

  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      if (
        lesson.exercise?.id === `${lang}-l5-ex3` &&
        lesson.exercise.validate.expected === "Validé"
      ) {
        lesson.exercise.prompt =
          "points vaut 15.\n\nUtilisez if : si points >= 10, affichez Validé.\n\nIci le test est vrai, donc Validé doit apparaître.\n\nAvec points = 15, affichez Validé si points >= 10.";
        lesson.exercise.hint = "if (points >= 10) affichez Validé.";
        lesson.title = "Petite décision";
        lesson.sections = [
          {
            type: "prose",
            body: "Utilisez une condition simple pour choisir un message.",
          },
        ];
      }

      if (lesson.id === `${lang}-l4-else` && !lesson.exercise) {
        const code =
          lang === "csharp"
            ? 'int n = 3;\nif (n > 5)\n{\n    Console.WriteLine("Grand");\n}\nelse\n{\n    Console.WriteLine("Petit");\n}'
            : lang === "cpp"
              ? '#include <iostream>\n\nint main() {\n    int n = 3;\n    if (n > 5) {\n        std::cout << "Grand" << std::endl;\n    } else {\n        std::cout << "Petit" << std::endl;\n    }\n    return 0;\n}'
              : 'int n = 3;\nif (n > 5) {\n    System.out.println("Grand");\n} else {\n    System.out.println("Petit");\n}';
        lesson.sections.push({ type: "code", code });
        const starter =
          lang === "csharp"
            ? "int temperature = 5;\n"
            : lang === "cpp"
              ? "#include <iostream>\n\nint main() {\n    int temperature = 5;\n    \n    return 0;\n}"
              : "public class Main {\n    public static void main(String[] args) {\n        int temperature = 5;\n        \n    }\n}";
        lesson.exercise = {
          id: `${lang}-l4-ex2`,
          prompt:
            "else signifie « sinon » : le cas où le if est faux.\n\nSans else, si le test échoue, rien ne s'affiche.\n\nAvec else, vous choisissez toujours un message.\n\ntemperature vaut 5.\n\nSi temperature < 10 → Froid, sinon → Doux.\n\nComme 5 < 10, la Sortie doit être Froid.\n\ntemperature = 5 : affichez Froid si < 10, sinon Doux.",
          hint: "Écrivez if … else …",
          starterCode: starter,
          validate: { type: "stdoutEquals", expected: "Froid" },
        };
      }
    }
  }

  fs.writeFileSync(file, JSON.stringify(track, null, 2) + "\n");
  console.log("fixed", lang);
}
