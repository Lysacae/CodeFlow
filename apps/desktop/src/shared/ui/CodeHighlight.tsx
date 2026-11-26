const KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "while",
  "return",
  "int",
  "string",
  "String",
  "bool",
  "boolean",
  "true",
  "false",
  "True",
  "False",
  "void",
  "public",
  "private",
  "static",
  "class",
  "namespace",
  "using",
  "include",
  "std",
  "cout",
  "cin",
  "endl",
  "print",
  "def",
  "import",
  "from",
  "in",
  "range",
  "new",
  "this",
  "null",
  "None",
  "var",
  "let",
  "const",
  "float",
  "double",
  "char",
  "Console",
  "WriteLine",
  "System",
  "out",
  "println",
  "main",
  "args",
]);

type Token =
  | { kind: "kw" | "str" | "num" | "cmt" | "plain"; text: string };

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < code.length) {
    // comments
    if (code.startsWith("//", i)) {
      const end = code.indexOf("\n", i);
      const slice = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ kind: "cmt", text: slice });
      i += slice.length;
      continue;
    }
    if (code[i] === "#") {
      const end = code.indexOf("\n", i);
      const slice = end === -1 ? code.slice(i) : code.slice(i, end);
      tokens.push({ kind: "cmt", text: slice });
      i += slice.length;
      continue;
    }
    // strings
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        if (code[j] === "\\") j += 2;
        else j += 1;
      }
      tokens.push({ kind: "str", text: code.slice(i, Math.min(j + 1, code.length)) });
      i = Math.min(j + 1, code.length);
      continue;
    }
    // numbers
    if (/[0-9]/.test(code[i]!)) {
      let j = i;
      while (j < code.length && /[0-9.]/.test(code[j]!)) j += 1;
      tokens.push({ kind: "num", text: code.slice(i, j) });
      i = j;
      continue;
    }
    // identifiers / keywords
    if (/[A-Za-z_]/.test(code[i]!)) {
      let j = i;
      while (j < code.length && /[A-Za-z0-9_]/.test(code[j]!)) j += 1;
      const word = code.slice(i, j);
      tokens.push({ kind: KEYWORDS.has(word) ? "kw" : "plain", text: word });
      i = j;
      continue;
    }
    tokens.push({ kind: "plain", text: code[i]! });
    i += 1;
  }
  return tokens;
}

const COLORS: Record<Token["kind"], string> = {
  kw: "#6C8CFF",
  str: "#E08A9B",
  num: "#5ED6A0",
  cmt: "#7A8499",
  plain: "var(--text)",
};

export function CodeHighlight({ code }: { code: string }) {
  const tokens = tokenize(code);
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-[16px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-left font-mono text-sm leading-relaxed">
      <code>
        {tokens.map((t, idx) => (
          <span key={idx} style={{ color: COLORS[t.kind] }}>
            {t.text}
          </span>
        ))}
      </code>
    </pre>
  );
}
