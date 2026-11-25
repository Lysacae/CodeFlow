import { sanitizeCompilerOutput } from "@/shared/lib/formatErrors";

export type AssistLevel = 1 | 2 | 3;

export type AssistResponse = {
  level: AssistLevel;
  title: string;
  explanation: string;
  lineHint?: string;
  tip: string;
  suggestedFix?: string;
};

function extractLine(stderr: string): string | undefined {
  const patterns = [
    /line (\d+)/i,
    /\((\d+),\d+\)/,
    /:(\d+):/,
    /\.java:(\d+):/,
    /\.py", line (\d+)/i,
  ];
  for (const pattern of patterns) {
    const match = stderr.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

export function buildAssistResponse(input: {
  language: string;
  stderr: string;
  code: string;
  expected?: string;
  hint?: string;
  level: AssistLevel;
  /** Faux quand l'exercice exige une structure (if, variable, boucle…). */
  allowLiteralFix?: boolean;
}): AssistResponse {
  const cleaned = sanitizeCompilerOutput(input.stderr);
  const line = extractLine(input.stderr);
  const lower = (input.stderr + "\n" + cleaned).toLowerCase();

  let explanation = cleaned;
  let tip =
    "Relisez la consigne, puis comparez votre sortie avec le texte demandé, caractère par caractère.";

  if (/point-virgule|;\s*»|cs1002|expected ';'/i.test(cleaned + input.stderr)) {
    tip =
      "Placez un point-virgule ; juste après la parenthèse fermante de l'instruction, avant la fin de la ligne.";
  } else if (lower.includes("syntaxerror") || lower.includes("syntaxe")) {
    tip =
      "Vérifiez guillemets, parenthèses et, selon le langage, points-virgules ou indentation.";
  } else if (input.expected && !input.stderr.trim()) {
    explanation =
      "Le programme s'est exécuté, mais le texte affiché n'est pas exactement celui demandé.";
    tip =
      input.hint ??
      "Vérifiez majuscules, espaces et ponctuation du message affiché.";
  } else if (!cleaned.trim()) {
    explanation =
      "Le programme n'a pas produit le résultat attendu, ou une erreur a interrompu l'exécution.";
  }

  const response: AssistResponse = {
    level: input.level,
    title:
      input.level === 1
        ? "Explication"
        : input.level === 2
          ? "Indice"
          : "Correction expliquée",
    explanation,
    tip,
    lineHint: line ? `Concentrez-vous sur la ligne ${line} de l'éditeur.` : undefined,
  };

  if (input.level >= 2) {
    response.tip =
      input.hint ??
      response.tip;
  }

  if (input.level >= 3 && input.expected && input.allowLiteralFix !== false) {
    if (input.language === "python") {
      response.suggestedFix = `print("${input.expected}")`;
    } else if (input.language === "csharp") {
      response.suggestedFix = `Console.WriteLine("${input.expected}");`;
    } else if (input.language === "cpp") {
      response.suggestedFix = `std::cout << "${input.expected}" << std::endl;`;
    } else if (input.language === "java") {
      response.suggestedFix = `System.out.println("${input.expected}");`;
    }
    response.explanation +=
      "\n\nVoici une instruction valide pour ce résultat. Lisez chaque symbole avant de l'adapter.";
  } else if (input.level >= 3 && input.allowLiteralFix === false) {
    response.explanation +=
      "\n\nAfficher seulement le texte attendu ne suffit pas. Le programme doit utiliser la notion de la leçon : la variable, le test, la boucle ou la fonction demandés.";
    response.tip =
      input.hint ??
      "Relisez l'exercice : la structure du code compte autant que la sortie.";
  }

  return response;
}
