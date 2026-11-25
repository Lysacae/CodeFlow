const BULLET_RE = /^(?:[-*•]|\d+[.)])\s+([\s\S]+)$/;
const VERSION_RE = /^(?:version|codeflow)\s+v?(\d+\.\d+(?:\.\d+)?)\b/i;

function unwrap(text: string): string {
  return text
    .replace(/^\*\*(.+)\*\*$/, "$1")
    .replace(/\*\*/g, "")
    .trim();
}

function titleOf(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || BULLET_RE.test(trimmed)) return null;

  const hashed = trimmed.match(/^#{1,6}\s+(.+)$/);
  const plain = unwrap(hashed ? hashed[1] : trimmed);
  if (!plain) return null;

  const version = plain.match(VERSION_RE);
  if (version && (hashed || /^(?:version|codeflow)\s+/i.test(plain))) {
    return `Version ${version[1]}`;
  }
  if (hashed) return plain;

  const label = plain.replace(/\s*:\s*$/, "");
  if (label.length <= 48 && !/[.!?;]/.test(label) && label.split(/\s+/).length <= 6) {
    return plain.includes(":") ? `${label} :` : plain;
  }
  return null;
}

function isDistributionsTitle(title: string): boolean {
  return /^distributions?$/i.test(title.replace(/\s*:\s*$/, "").trim());
}

/**
 * Une ligne vide après le titre de section, des puces collées,
 * une seule ligne vide entre les blocs (Correction / Ajout).
 * Les sauts de ligne en trop du texte source sont ignorés.
 */
export function formatUpdateNotes(notes: string): string {
  const blocks: { title: string; lines: string[] }[] = [];
  let skipping = false;

  const current = () => {
    if (!blocks.length) blocks.push({ title: "", lines: [] });
    return blocks[blocks.length - 1];
  };

  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line === "---" || line === "***") continue;

    const title = titleOf(line);
    if (title) {
      if (isDistributionsTitle(title)) {
        skipping = true;
        continue;
      }
      skipping = false;
      blocks.push({ title, lines: [] });
      continue;
    }

    if (skipping) continue;
    const bullet = line.match(BULLET_RE);
    const text = unwrap(bullet ? bullet[1] : line).replace(/^[-*•]\s+/, "");
    if (!text) continue;
    current().lines.push(`- ${text}`);
  }

  return blocks
    .filter((block) => block.title || block.lines.length)
    .map((block) => {
      const out: string[] = [];
      if (block.title) {
        out.push(block.title);
        if (block.lines.length) out.push("");
      }
      out.push(...block.lines);
      return out.join("\n");
    })
    .join("\n\n")
    .trim();
}
