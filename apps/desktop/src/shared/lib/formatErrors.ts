/**
 * Transforme les messages bruts du compilateur / interpréteur
 * en explications précises, sans chemins techniques inutiles.
 */

export function sanitizeCompilerOutput(raw: string): string {
  if (!raw.trim()) return raw;

  let text = raw
    // Chemins sandbox / projets
    .replace(/\[[A-Za-z]:\\[^\]]+\]/g, "")
    .replace(/[A-Za-z]:\\Users\\[^\s\]:]+/g, "")
    .replace(/\/(?:home|Users|tmp|var)\/[^\s\]:]+/g, "")
    .replace(/sandbox\\[a-f0-9-]+\\?/gi, "")
    .replace(/App\.csproj/gi, "")
    .replace(/Program\.cs/gi, "votre fichier")
    .replace(/main\.cpp/gi, "votre fichier")
    .replace(/Main\.java/gi, "votre fichier")
    .replace(/main\.py/gi, "votre fichier");

  const explanations: string[] = [];

  // C# / .NET
  if (/CS1002/i.test(text) || (/;\s*attendu/i.test(text) && /error/i.test(text))) {
    const line = matchLine(text);
    explanations.push(
      line
        ? `Erreur précise (ligne ${line}) : il manque un point-virgule « ; » à la fin de l'instruction.`
        : `Erreur précise : il manque un point-virgule « ; » à la fin d'une instruction.`,
    );
    explanations.push(
      "En C#, presque chaque instruction se termine par ;. Sans ce symbole, le compilateur ne sait pas où l'instruction s'arrête.",
    );
  } else if (/CS1525/i.test(text)) {
    explanations.push(
      "Erreur précise : un symbole est placé à un endroit où le compilateur ne l'attend pas. Vérifiez parenthèses, accolades et points-virgules autour de la ligne indiquée.",
    );
  } else if (/CS0103/i.test(text)) {
    explanations.push(
      "Erreur précise : un nom est utilisé alors qu'il n'existe pas encore (variable ou méthode introuvable). Vérifiez l'orthographe et la déclaration.",
    );
  } else if (/CS1003/i.test(text)) {
    explanations.push(
      "Erreur précise : un symbole attendu est manquant (souvent « ) », « } » ou « , »).",
    );
  }

  // Java
  if (/';s*;'\s*expected/i.test(text) || /';s*;\s*'\s*expected/i.test(text)) {
    const line = matchLine(text);
    explanations.push(
      line
        ? `Erreur précise (ligne ${line}) : il manque un point-virgule « ; » à la fin de l'instruction.`
        : `Erreur précise : il manque un point-virgule « ; ».`,
    );
  } else if (/cannot find symbol/i.test(text)) {
    explanations.push(
      "Erreur précise : un nom utilisé dans le code est inconnu. Vérifiez l'orthographe de la variable, de la méthode ou de la classe.",
    );
  } else if (/class .+ is public, should be declared in a file named/i.test(text)) {
    explanations.push(
      "Erreur précise : en Java, le nom du fichier doit être identique au nom de la classe publique.",
    );
  }

  // C++
  if (/expected\s*';\s*before/i.test(text) || /expected\s*';/i.test(text)) {
    const line = matchLine(text);
    explanations.push(
      line
        ? `Erreur précise (ligne ${line}) : il manque un point-virgule « ; ».`
        : `Erreur précise : il manque un point-virgule « ; ».`,
    );
  }

  // Python
  if (/SyntaxError:\s*invalid syntax/i.test(text)) {
    const line = matchLine(text);
    explanations.push(
      line
        ? `Erreur précise (ligne ${line}) : la syntaxe de cette ligne est incorrecte (parenthèse, guillemet ou deux-points manquant).`
        : `Erreur précise : syntaxe incorrecte sur une ligne.`,
    );
  } else if (/SyntaxError:\s*EOL while scanning string literal|unterminated string/i.test(text)) {
    explanations.push(
      "Erreur précise : une chaîne de texte n'est pas correctement fermée. Vérifiez les guillemets ouvrants et fermants.",
    );
  } else if (/NameError/i.test(text)) {
    explanations.push(
      "Erreur précise : un nom est utilisé alors qu'il n'a pas été défini. Vérifiez l'orthographe de la variable.",
    );
  } else if (/IndentationError/i.test(text)) {
    explanations.push(
      "Erreur précise : l'indentation (espaces en début de ligne) est incorrecte. Alignez le bloc comme dans l'exemple du cours.",
    );
  }

  // Nettoyage des lignes techniques restantes
  const cleanedLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (/^\s*at\s+/i.test(l)) return false;
      if (/Microsoft\.|dotnet|CSC|Build FAILED|build a échoué/i.test(l)) return false;
      if (/error CS\d+/i.test(l) && explanations.length > 0) return false;
      if (/^\d+\s*(Avertissement|Erreur|Warning|Error)/i.test(l)) return false;
      if (/Temps écoulé|Time Elapsed/i.test(l)) return false;
      return true;
    });

  if (explanations.length > 0) {
    return explanations.join("\n\n");
  }

  // Fallback : garder un message court sans chemins
  const fallback = cleanedLines.join("\n").trim();
  return fallback || "Une erreur a empêché l'exécution. Relisez la ligne concernée dans l'éditeur.";
}

function matchLine(text: string): string | undefined {
  const patterns = [
    /\((\d+),\d+\)/,
    /line (\d+)/i,
    /:(\d+):\d+/,
    /\.java:(\d+):/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return undefined;
}

export function formatExecuteDisplay(input: {
  stdout: string;
  stderr: string;
  compileOutput?: string | null;
  success: boolean;
  exitCode?: number | null;
  timedOut?: boolean;
}): string {
  if (input.success) {
    return input.stdout.trim() || "(aucune sortie)";
  }

  const parts: string[] = [];
  const raw = [input.stderr, input.compileOutput].filter(Boolean).join("\n");
  const human = sanitizeCompilerOutput(raw);
  const out = input.stdout.trim();

  if (out) parts.push(out);
  if (human) parts.push(human);

  if (parts.length === 0) {
    if (input.timedOut) {
      parts.push("Délai dépassé : le programme a été arrêté.");
    } else {
      parts.push(
        "Aucune sortie ni message d'erreur n'a été renvoyé.",
      );
      parts.push(
        "Causes fréquentes : alias Python Microsoft Store, runtime manquant, ou exécutable bloqué.",
      );
    }
  }

  const logs: string[] = [];
  if (input.timedOut) logs.push("timeout=oui");
  if (input.exitCode != null) logs.push(`code=${input.exitCode}`);
  if (!out) logs.push("stdout=vide");
  if (!raw.trim()) logs.push("stderr=vide");
  if (logs.length > 0) {
    parts.push(`\n[log] ${logs.join(" · ")}`);
  }

  return parts.join("\n\n");
}
