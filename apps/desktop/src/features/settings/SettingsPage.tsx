import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiLatestUpdate } from "@/shared/lib/api";
import { isDevTesting } from "@/shared/lib/devAccess";
import {
  devDiagnostics,
  downloadAndRunUpdate,
  openUpdateUrl,
  type Diagnostics,
} from "@/shared/lib/tauri";
import { THEME_OPTIONS, themeLabel } from "@/shared/lib/theme";
import { APP_VERSION, isNewerVersion } from "@/shared/lib/version";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { Button } from "@/shared/ui/Button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { GlassCard } from "@/shared/ui/GlassCard";
import { PasswordField } from "@/shared/ui/PasswordField";
import { Spinner } from "@/shared/ui/Spinner";

const DELETE_PHRASE = "Je confirme la suppression définitive";

export function SettingsPage() {
  const { progress, updateTheme } = useProgressStore();
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [themeBusy, setThemeBusy] = useState<string | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<Diagnostics | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsBusy, setLogsBusy] = useState(false);
  const dev = isDevTesting(useAuthStore((s) => s.user?.username));
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const navigate = useNavigate();
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (deletePhrase.trim() !== DELETE_PHRASE) {
      setDeleteError("Recopiez exactement la phrase de confirmation.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount(deletePassword);
      navigate("/auth");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Impossible de supprimer le compte.");
      setDeleting(false);
    }
  };

  const openLogs = async () => {
    setLogsOpen(true);
    setLogsBusy(true);
    setLogsError(null);
    try {
      setLogs(await devDiagnostics());
    } catch (e) {
      setLogsError(e instanceof Error ? e.message : String(e));
    } finally {
      setLogsBusy(false);
    }
  };

  const checkUpdates = async () => {
    setUpdateBusy(true);
    setUpdateMessage(null);
    setUpdateError(null);
    setDownloadUrl(null);
    try {
      const latest = await apiLatestUpdate();
      if (!latest.version || !latest.downloadUrl) {
        setUpdateMessage(`CodeFlow ${APP_VERSION} est à jour.`);
        return;
      }
      if (isNewerVersion(latest.version, APP_VERSION)) {
        setUpdateMessage(
          `Une nouvelle version est disponible : ${latest.version} (vous avez ${APP_VERSION}).`,
        );
        setDownloadUrl(latest.downloadUrl);
      } else {
        setUpdateMessage(`CodeFlow ${APP_VERSION} est à jour.`);
      }
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : String(e));
    } finally {
      setUpdateBusy(false);
    }
  };

  const installUpdate = async () => {
    if (!downloadUrl) return;
    setUpdateBusy(true);
    setUpdateError(null);
    let started = false;
    try {
      await downloadAndRunUpdate(downloadUrl);
      started = true;
      setUpdateMessage("CodeFlow se ferme pour installer la mise à jour…");
    } catch (e) {
      setUpdateError(e instanceof Error ? e.message : String(e));
      try {
        await openUpdateUrl(downloadUrl);
      } catch {
        /* ignore */
      }
    } finally {
      if (!started) setUpdateBusy(false);
    }
  };

  const swatch: Record<string, { bg: string; dot: string }> = {
    dark: { bg: "#05060b", dot: "#6b7cff" },
    light: { bg: "#f3f4fa", dot: "#4f5ff0" },
    prune: { bg: "#0a0510", dot: "#b07cff" },
    salad: { bg: "#040a08", dot: "#3ee0a8" },
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label kicker">Système</div>
          <h1>Paramètres</h1>
          <p className="sub">Personnalisez l'interface et les environnements.</p>
        </div>
      </div>

      <div className="settings">
        <GlassCard>
          <div className="card-title"><h3>Apparence</h3></div>
          <p className="muted" style={{ fontSize: 14 }}>
            Thème actuel : <span style={{ color: "var(--text)" }}>{themeLabel(progress.theme)}</span>
          </p>
          <div className="theme-row">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className={progress.theme === option.id ? "theme-chip on" : "theme-chip"}
                disabled={themeBusy !== null}
                onClick={() => {
                  setThemeBusy(option.id);
                  void updateTheme(option.id).finally(() => setThemeBusy(null));
                }}
              >
                <span className="sw" style={{ background: swatch[option.id]?.bg }}>
                  <i style={{ background: swatch[option.id]?.dot }} />
                </span>
                {themeBusy === option.id ? "…" : option.label}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <div className="card-title"><h3>Environnements</h3></div>
          <p className="muted" style={{ fontSize: 14 }}>
            Détectez et installez Python, .NET, un compilateur C++ et le JDK.
          </p>
          <Link to="/settings/runtimes">
            <Button>Ouvrir les environnements</Button>
          </Link>
        </GlassCard>

        <GlassCard className="span2">
          <div className="card-title"><h3>Aide</h3></div>
          <p className="text-sm text-[var(--text-secondary)]">
            Questions et retours : coordonnées de l'auteur.
          </p>
          <dl className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <dt className="w-24 text-[var(--text-secondary)]">GitHub</dt>
              <dd>
                <button
                  type="button"
                  className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                  onClick={() => void openUpdateUrl("https://github.com/Lysacae/CodeFlow")}
                >
                  lysacae
                </button>
              </dd>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <dt className="w-24 text-[var(--text-secondary)]">Discord</dt>
              <dd className="font-medium text-[var(--text)]">lysacae</dd>
            </div>
          </dl>
        </GlassCard>

        <GlassCard className="span2 update">
          <div>
          <div className="card-title"><h3>Mises à jour</h3></div>
          <p className="text-sm text-[var(--text-secondary)]">
            Version installée : <span className="font-semibold text-[var(--text)]">{APP_VERSION}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {downloadUrl ? (
              <Button variant="secondary" onClick={() => void installUpdate()} disabled={updateBusy}>
                {updateBusy ? <Spinner size="sm" /> : null}
                {updateBusy ? "Installation…" : "Installer la mise à jour"}
              </Button>
            ) : null}
          </div>
          {updateMessage ? (
            <p className="text-sm text-[var(--success)]">{updateMessage}</p>
          ) : null}
          {updateError ? (
            <p className="text-sm text-[var(--error)]">{updateError}</p>
          ) : null}
          </div>
          <Button onClick={() => void checkUpdates()} disabled={updateBusy}>
            {updateBusy && !downloadUrl ? <Spinner size="sm" /> : null}
            {updateBusy && !downloadUrl ? "Vérification…" : "Vérifier les mises à jour"}
          </Button>
        </GlassCard>

        <GlassCard className="span2 danger-card">
          <div>
          <div className="card-title"><h3 style={{ color: "var(--danger)" }}>Supprimer mon compte</h3></div>
          <p className="text-sm text-[var(--text-secondary)]">
            La suppression est définitive : pseudo, progression, projets et photo.
          </p>
          </div>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={() => {
              setDeletePassword("");
              setDeletePhrase("");
              setDeleteError(null);
              setDeleteStep(1);
            }}
          >
            Supprimer mon compte
          </Button>
        </GlassCard>

        {dev ? (
          <GlassCard className="span2">
            <div className="card-title"><h3>Logs</h3></div>
            <p className="text-sm text-[var(--text-secondary)]">
              Version, chemins, détection des environnements et erreurs récentes.
            </p>
            <Button variant="secondary" onClick={() => void openLogs()}>
              Logs
            </Button>
          </GlassCard>
        ) : null}
      </div>

      {deleteStep === 1 ? (
        <ConfirmDialog
          title="Supprimer mon compte"
          body="Êtes-vous sûr ? Cette action est définitive : pseudo, progression, projets et photo seront effacés."
          confirmLabel="Continuer"
          danger
          onCancel={() => setDeleteStep(0)}
          onConfirm={() => setDeleteStep(2)}
        />
      ) : null}

      {deleteStep === 2 ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Supprimer mon compte</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Deuxième vérification. Saisissez votre mot de passe, puis recopiez :{" "}
                <span className="font-medium text-[var(--text)]">{DELETE_PHRASE}</span>
              </p>
            </div>
            <PasswordField
              value={deletePassword}
              onChange={setDeletePassword}
              placeholder="Mot de passe"
              autoComplete="current-password"
              disabled={deleting}
            />
            <input
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
              placeholder={DELETE_PHRASE}
              disabled={deleting}
              className="allow-select h-11 w-full rounded-[12px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            {deleteError ? <p className="text-sm text-[var(--error)]">{deleteError}</p> : null}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={deleting} onClick={() => setDeleteStep(0)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={
                  deleting ||
                  deletePassword.length === 0 ||
                  deletePhrase.trim() !== DELETE_PHRASE
                }
                onClick={() => void confirmDelete()}
              >
                {deleting ? <Spinner size="sm" /> : null}
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </div>
          </GlassCard>
        </div>
      ) : null}

      {logsOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-6 py-8 backdrop-blur-sm">
          <GlassCard className="max-h-[80vh] w-full max-w-3xl space-y-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-semibold">Logs</h2>
              <Button variant="ghost" onClick={() => setLogsOpen(false)}>
                Fermer
              </Button>
            </div>
            {logsBusy ? (
              <div className="flex justify-center py-8">
                <Spinner label="Lecture…" />
              </div>
            ) : null}
            {logsError ? <p className="text-sm text-[var(--error)]">{logsError}</p> : null}
            {logs ? (
              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4 font-mono text-xs text-[var(--text)]">
                {formatDiagnostics(logs)}
              </pre>
            ) : null}
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}

function formatDiagnostics(logs: Diagnostics): string {
  const runtimes = logs.runtimes
    .map((runtime) => {
      const state = runtime.installed ? "installé" : "absent";
      const version = runtime.version ? ` ${runtime.version}` : "";
      const path = runtime.path ? `\n    ${runtime.path}` : "";
      return `- ${runtime.name} : ${state}${version}${path}`;
    })
    .join("\n");
  const errors =
    logs.recentErrors.length > 0 ? logs.recentErrors.map((line) => `- ${line}`).join("\n") : "- aucune";
  return [
    `Version : ${logs.version}`,
    `Administrateur : ${logs.elevated ? "oui" : "non"}`,
    `Winget : ${logs.wingetPath || "introuvable"}`,
    `Base : ${logs.dbPath}`,
    `Données : ${logs.appData}`,
    `Projets : ${logs.projectsDir}`,
    `Bac à sable : ${logs.sandboxDir}`,
    "",
    "Environnements",
    runtimes || "- aucun",
    "",
    "Erreurs récentes",
    errors,
  ].join("\n");
}
