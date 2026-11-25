import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getLanguage } from "@/shared/lib/content";
import {
  restoreCloudProject,
  syncLocalProjectsToCloud,
} from "@/shared/lib/projectsSync";
import {
  executeCode,
  listPrograms,
  saveProgram,
  type ExecuteResult,
  type SavedProgram,
} from "@/shared/lib/tauri";
import { useAuthStore } from "@/shared/store/authStore";
import { CodeEditor } from "@/features/editor/CodeEditor";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";

export function NotebookPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [programs, setPrograms] = useState<SavedProgram[]>([]);
  const [cloudProjects, setCloudProjects] = useState<SavedProgram[] | null>(null);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SavedProgram | null>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
    const list = await listPrograms();
    setPrograms(list);
    try {
      const remote = await syncLocalProjectsToCloud();
      setCloudProjects(remote);
      setCloudError(null);
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : String(e));
    }
    if (selected) {
      const updated = list.find((p) => p.id === selected.id) ?? null;
      setSelected(updated);
      if (updated) setCode(updated.code);
    }
    } finally {
      setLoading(false);
    }
  };

  const restore = async (project: SavedProgram) => {
    setRestoringId(project.id);
    setMessage(null);
    try {
      await restoreCloudProject(project);
      setMessage(`${project.fileName} a été réinstallé sur cet ordinateur.`);
      await refresh();
    } catch (e) {
      setCloudError(e instanceof Error ? e.message : String(e));
    } finally {
      setRestoringId(null);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const language = selected ? getLanguage(selected.language) : null;

  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <div className="label kicker">Archives</div>
          <h1>Carnet de programmation</h1>
          <p className="sub">Retrouvez les programmes que vous avez créés et sauvegardés.</p>
        </div>
      </div>

      <div className="carnet">
        <div className="space-y-3">
          <GlassCard className="space-y-3">
            <h2 className="text-lg font-semibold">Projets cloud</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Enregistrés sur votre compte. Sur un autre ordinateur, connectez-vous
              puis réinstallez-les ici.
            </p>
            {cloudError ? (
              <div className="space-y-2">
                <p className="text-sm text-[var(--error)]">{cloudError}</p>
                {cloudError.toLowerCase().includes("expir") ? (
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      await logout();
                      navigate("/auth");
                    }}
                  >
                    Se reconnecter
                  </Button>
                ) : null}
              </div>
            ) : null}
            {cloudProjects === null && !cloudError ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Session cloud indisponible. Reconnectez-vous pour synchroniser vos projets.
              </p>
            ) : null}
            {cloudProjects && cloudProjects.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Aucun projet dans le cloud pour le moment.
              </p>
            ) : null}
            {cloudProjects?.map((project) => {
              const local = programs.some((item) => item.id === project.id);
              return (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{project.fileName}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {getLanguage(project.language)?.name ?? project.language}
                      {local ? " · déjà sur cet ordinateur" : ""}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => void restore(project)}
                    disabled={restoringId === project.id}
                  >
                    {restoringId === project.id ? <Spinner size="sm" /> : null}
                    {restoringId === project.id ? "Réinstallation…" : "Réinstaller"}
                  </Button>
                </div>
              );
            })}
          </GlassCard>
          {loading && programs.length === 0 ? (
            <GlassCard className="py-10">
              <Spinner label="Chargement du carnet…" />
            </GlassCard>
          ) : programs.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-[var(--text-secondary)]">
                Aucun fichier pour le moment. Terminez l'étape « Créer ton premier
                fichier » dans un parcours.
              </p>
            </GlassCard>
          ) : (
            programs.map((program) => (
              <button
                key={program.id}
                type="button"
                onClick={() => {
                  setSelected(program);
                  setCode(program.code);
                  setResult(null);
                  setMessage(null);
                }}
                className={`w-full rounded-[16px] border px-4 py-3 text-left transition ${
                  selected?.id === program.id
                    ? "border-[var(--accent)] bg-[var(--surface-strong)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-strong)]"
                }`}
              >
                <div className="font-medium">{program.fileName}</div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {getLanguage(program.language)?.name ?? program.language}
                </div>
              </button>
            ))
          )}
        </div>

        <div>
          {selected && language ? (
            <div className="space-y-3">
              {message ? (
                <p className="text-sm text-[var(--success)]">{message}</p>
              ) : null}
              <CodeEditor
                language={selected.language}
                monacoLanguage={language.monaco}
                value={code}
                onChange={setCode}
                running={running}
                result={result}
                onRun={async () => {
                  setRunning(true);
                  try {
                    const res = await executeCode({
                      language: selected.language,
                      code,
                      fileName: selected.fileName,
                    });
                    setResult(res);
                    void import("@/shared/store/progressionStore").then((mod) =>
                      mod.useProgressionStore.getState().record(
                        res.success ? { runsOk: 1 } : { runsFail: 1 },
                      ),
                    );
                  } finally {
                    setRunning(false);
                  }
                }}
                extraActions={
                  <Button
                    variant="secondary"
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const saved = await saveProgram({
                          id: selected.id,
                          name: selected.name,
                          language: selected.language,
                          fileName: selected.fileName,
                          code,
                        });
                        try {
                          await syncLocalProjectsToCloud();
                        } catch (e) {
                          setCloudError(e instanceof Error ? e.message : String(e));
                        }
                        setSelected(saved);
                        setMessage("Fichier sauvegardé.");
                        await refresh();
                        void import("@/shared/store/progressionStore").then((mod) =>
                          mod.useProgressionStore.getState().reconcile(),
                        );
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    {saving ? <Spinner size="sm" /> : null}
                    {saving ? "Sauvegarde…" : "Sauvegarder"}
                  </Button>
                }
              />
            </div>
          ) : (
            <GlassCard>
              <p className="text-sm text-[var(--text-secondary)]">
                Sélectionnez un programme pour l'ouvrir.
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
