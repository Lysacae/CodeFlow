import Editor, { type OnMount } from "@monaco-editor/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";
import { formatExecuteDisplay } from "@/shared/lib/formatErrors";
import type { ExecuteResult } from "@/shared/lib/tauri";

type Props = {
  language: string;
  monacoLanguage: string;
  value: string;
  onChange: (value: string) => void;
  onRun: () => void;
  onReset?: () => void;
  running?: boolean;
  result?: ExecuteResult | null;
  successMessage?: string | null;
  extraActions?: ReactNode;
  footerActions?: ReactNode;
  highlightLine?: number | null;
};

const MIN_OUTPUT = 80;
const MAX_OUTPUT = 240;
const DEFAULT_OUTPUT = 120;
const EDITOR_HEIGHT = 280;

export function CodeEditor({
  monacoLanguage,
  value,
  onChange,
  onRun,
  onReset,
  running,
  result,
  successMessage,
  extraActions,
  footerActions,
  highlightLine,
}: Props) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Parameters<OnMount>[1] | null>(null);
  const [editorReady, setEditorReady] = useState(0);
  const theme =
    document.documentElement.getAttribute("data-theme") === "light"
      ? "light"
      : "vs-dark";
  const [outputHeight, setOutputHeight] = useState(DEFAULT_OUTPUT);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - e.clientY;
      const next = Math.min(
        MAX_OUTPUT,
        Math.max(MIN_OUTPUT, dragRef.current.startH + delta),
      );
      setOutputHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !highlightLine) return;
    const decorations = editor.createDecorationsCollection([
      {
        range: new monaco.Range(highlightLine, 1, highlightLine, 1),
        options: { isWholeLine: true, className: "cf-step-line" },
      },
    ]);
    editor.revealLineInCenter(highlightLine);
    return () => decorations.clear();
  }, [highlightLine, value, editorReady]);

  const outputText =
    result == null
      ? null
      : formatExecuteDisplay({
          stdout: result.stdout,
          stderr: result.stderr,
          compileOutput: result.compileOutput,
          success: result.success,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
        });

  return (
    <div className="relative flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-secondary)]">
      {running ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--overlay-bg)] backdrop-blur-[2px]">
          <Spinner label="Exécution en cours…" />
        </div>
      ) : null}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm text-[var(--text-secondary)]">Éditeur</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {extraActions}
          {onReset ? (
            <Button variant="secondary" onClick={onReset} disabled={running}>
              Réinitialiser
            </Button>
          ) : null}
          <Button onClick={onRun} disabled={running}>
            {running ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                Exécution…
              </span>
            ) : (
              "Exécuter"
            )}
          </Button>
        </div>
      </div>

      <div className="allow-select shrink-0" style={{ height: EDITOR_HEIGHT }}>
        <Editor
          height={EDITOR_HEIGHT}
          language={monacoLanguage}
          theme={theme}
          value={value}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
            setEditorReady((value) => value + 1);
          }}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize: 14,
            fontFamily: "var(--font-mono)",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            padding: { top: 16, bottom: 16 },
            contextmenu: false,
          }}
        />
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Redimensionner la sortie"
        className="flex h-3 shrink-0 cursor-row-resize items-center justify-center border-t border-[var(--border)] bg-[rgba(0,0,0,0.12)] hover:bg-[rgba(108,140,255,0.15)]"
        onMouseDown={(e) => {
          e.preventDefault();
          dragRef.current = { startY: e.clientY, startH: outputHeight };
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
        }}
      >
        <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
      </div>

      <div
        className="shrink-0 overflow-hidden border-t border-[var(--border)] bg-[rgba(0,0,0,0.15)] px-4 py-2"
        style={{ height: outputHeight }}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
            Sortie
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
              onClick={() => setOutputHeight(MIN_OUTPUT)}
            >
              Réduire
            </button>
            <button
              type="button"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
              onClick={() => setOutputHeight(180)}
            >
              Agrandir
            </button>
          </div>
        </div>
        {successMessage ? (
          <div className="mb-1 rounded-[10px] border border-[rgba(94,214,160,0.35)] bg-[rgba(94,214,160,0.12)] px-3 py-1.5 text-sm text-[var(--success)]">
            {successMessage}
          </div>
        ) : null}
        <div className="h-[calc(100%-1.75rem)] overflow-auto">
          {outputText != null ? (
            <pre
              className={`whitespace-pre-wrap font-mono text-sm ${
                result?.success ? "text-[var(--text)]" : "text-[var(--error)]"
              }`}
            >
              {outputText}
            </pre>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">
              La sortie du programme apparaîtra ici.
            </p>
          )}
        </div>
      </div>

      {footerActions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-[var(--border)] px-4 py-3">
          {footerActions}
        </div>
      ) : null}
    </div>
  );
}
