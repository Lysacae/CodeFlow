import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { CodeEditor } from "@/features/editor/CodeEditor";
import { getLanguage } from "@/shared/lib/content";
import { syncLocalProjectsToCloud } from "@/shared/lib/projectsSync";
import {
  executeCode,
  saveProgram,
  writeUserFile,
  type ExecuteResult,
} from "@/shared/lib/tauri";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";

type Props = {
  languageId: string;
  defaultName: string;
  extension: string;
  starterCode: string;
  notes?: string[];
  requireClassNameMatch?: boolean;
  onSaved: () => void;
  onContinue: () => void;
};

export function FileWizard({
  languageId,
  defaultName,
  extension,
  starterCode,
  notes = [],
  requireClassNameMatch,
  onSaved,
  onContinue,
}: Props) {
  const language = getLanguage(languageId)!;
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState(starterCode);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const fileName = `${name}${ext}`;

  const validateName = () => {
    if (!name.trim()) return "Indiquez un nom de fichier.";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return "Utilisez uniquement des lettres, chiffres et underscores, sans commencer par un chiffre.";
    }
    if (requireClassNameMatch) {
      const match = code.match(/public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (match && match[1] !== name) {
        return `Le nom du fichier (${name}) doit correspondre à la classe publique (${match[1]}).`;
      }
    }
    return null;
  };

  const onRun = async () => {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const res = await executeCode({
        language: languageId,
        code,
        fileName,
      });
      setResult(res);
    } catch (e) {
      setResult({
        success: false,
        stdout: "",
        stderr: e instanceof Error ? e.message : String(e),
        exitCode: null,
        timedOut: false,
        compileOutput: null,
      });
    } finally {
      setRunning(false);
    }
  };

  const onSave = async () => {
    const validationError = validateName();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const selected = await save({
        defaultPath: fileName,
        filters: [
          {
            name: language.name,
            extensions: [ext.replace(".", "")],
          },
        ],
      });

      if (!selected) {
        setMessage("Enregistrement annulé.");
        return;
      }

      const path = await writeUserFile(selected, code);
      await saveProgram({
        name,
        language: languageId,
        fileName,
        code,
      });
      let cloudNote: string | null = null;
      try {
        await syncLocalProjectsToCloud();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("expir")) cloudNote = message;
      }
      setSavedPath(path);
      setSaved(true);
      setMessage(cloudNote ?? `Fichier enregistré : ${path}`);
      void import("@/shared/store/progressionStore").then((mod) =>
        mod.useProgressionStore.getState().reconcile(),
      );
      onSaved();
    } catch (e) {
      // Fallback carnet local si le dialogue n'est pas disponible
      const program = await saveProgram({
        name,
        language: languageId,
        fileName,
        code,
      });
      let cloudNote: string | null = null;
      try {
        await syncLocalProjectsToCloud();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("expir")) cloudNote = message;
      }
      setSaved(true);
      setSavedPath(program.fileName);
      void import("@/shared/store/progressionStore").then((mod) =>
        mod.useProgressionStore.getState().reconcile(),
      );
      setMessage(
        cloudNote ??
          `Fichier enregistré dans le carnet CodeFlow (${program.fileName}). ${
            e instanceof Error ? e.message : ""
          }`,
      );
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[0.9fr_1.3fr]">
      <div className="glass space-y-4 p-6 text-left">
        <div>
          <label className="text-sm text-[var(--text-secondary)]" htmlFor="filename">
            Nom du fichier
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id="filename"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 text-left outline-none focus:border-[var(--accent)]"
            />
            <span className="rounded-[12px] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              {ext}
            </span>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Fichier : <span className="text-[var(--text)]">{fileName}</span>
        </p>
        <ul className="space-y-2 text-left text-sm text-[var(--text-secondary)]">
          {notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
          <li>• Vous choisirez l'emplacement d'enregistrement sur votre ordinateur.</li>
        </ul>
        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
        {message ? (
          <p className="break-all text-sm text-[var(--success)]">{message}</p>
        ) : null}
        {savedPath ? (
          <p className="break-all text-xs text-[var(--text-secondary)]">{savedPath}</p>
        ) : null}
        <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
          <Button onClick={() => void onSave()} disabled={saving}>
            {saving ? <Spinner size="sm" /> : null}
            {saving ? "Enregistrement…" : "Sauvegarder le fichier"}
          </Button>
          <Button variant="secondary" onClick={onContinue} disabled={!saved}>
            Continuer
          </Button>
        </div>
      </div>

      <CodeEditor
        language={languageId}
        monacoLanguage={language.monaco}
        value={code}
        onChange={setCode}
        onRun={onRun}
        onReset={() => {
          setCode(starterCode);
          setResult(null);
          setMessage(null);
        }}
        running={running}
        result={result}
      />
    </div>
  );
}
