import { z } from "zod";

/** Règle de structure : texte à trouver, ou motif. Le message est montré au junior. */
export const checkRuleSchema = z.union([
  z.string(),
  z
    .object({
      text: z.string().optional(),
      pattern: z.string().optional(),
      message: z.string(),
    })
    .refine((rule) => Boolean(rule.text || rule.pattern), {
      message: "Règle de validation incomplète",
    }),
]);

export const exerciseChecksSchema = z.object({
  mustInclude: z.array(checkRuleSchema).optional(),
  mustMatch: z.array(checkRuleSchema).optional(),
  forbidCheats: z.array(checkRuleSchema).optional(),
});

export type CheckRule = z.infer<typeof checkRuleSchema>;
export type ExerciseChecks = z.infer<typeof exerciseChecksSchema>;

/** Retire les commentaires pour qu'un `# if else` ne fasse pas passer l'exercice. */
export function stripComments(code: string): string {
  let out = "";
  let i = 0;
  const n = code.length;

  while (i < n) {
    const c = code[i];
    const next = code[i + 1];

    if (c === "/" && next === "/") {
      while (i < n && code[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i = Math.min(n, i + 2);
      continue;
    }
    if (c === "#") {
      while (i < n && code[i] !== "\n") i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      if (code.slice(i, i + 3) === quote.repeat(3)) {
        out += quote.repeat(3);
        i += 3;
        while (i < n && code.slice(i, i + 3) !== quote.repeat(3)) {
          if (code[i] === "\\") {
            out += code[i] + (code[i + 1] ?? "");
            i += 2;
            continue;
          }
          out += code[i++];
        }
        out += code.slice(i, i + 3);
        i += 3;
        continue;
      }
      out += c;
      i++;
      while (i < n && code[i] !== quote) {
        if (code[i] === "\\") {
          out += code[i] + (code[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (code[i] === "\n") break;
        out += code[i++];
      }
      if (i < n && code[i] === quote) out += code[i++];
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function compile(pattern: string): RegExp {
  // Pas de drapeau m : ^ doit viser le début du programme, pas chaque ligne.
  return new RegExp(pattern);
}

export function assertChecksCompile(checks: ExerciseChecks | undefined): void {
  if (!checks) return;
  for (const rule of [...(checks.mustMatch ?? []), ...(checks.forbidCheats ?? [])]) {
    const pattern = typeof rule === "string" ? rule : rule.pattern;
    if (!pattern) continue;
    compile(pattern);
  }
}

function includeText(rule: CheckRule): { text: string; message: string } | null {
  if (typeof rule === "string") {
    return {
      text: rule,
      message: `Le programme doit contenir « ${rule} ».`,
    };
  }
  if (!rule.text) return null;
  return { text: rule.text, message: rule.message };
}

function patternOf(rule: CheckRule, fallback: string): { pattern: string; message: string } | null {
  if (typeof rule === "string") return { pattern: rule, message: fallback };
  if (!rule.pattern) return null;
  return { pattern: rule.pattern, message: rule.message };
}

/**
 * Vérifie que le code respecte l'intention de l'exercice, pas seulement la sortie.
 * Retourne un message en français, ou null si la structure est acceptée.
 */
export function evaluateChecks(code: string, checks: ExerciseChecks | undefined): string | null {
  if (!checks) return null;
  const source = stripComments(code);

  for (const rule of checks.forbidCheats ?? []) {
    const parsed = patternOf(
      rule,
      "Cette solution affiche le résultat sans utiliser ce que la leçon enseigne.",
    );
    if (!parsed) continue;
    if (compile(parsed.pattern).test(source)) return parsed.message;
  }

  for (const rule of checks.mustInclude ?? []) {
    const parsed = includeText(rule);
    if (!parsed) continue;
    if (!source.includes(parsed.text)) return parsed.message;
  }

  for (const rule of checks.mustMatch ?? []) {
    const parsed = patternOf(rule, "Le programme ne correspond pas encore à l'exercice.");
    if (!parsed) continue;
    if (!compile(parsed.pattern).test(source)) return parsed.message;
  }

  return null;
}
