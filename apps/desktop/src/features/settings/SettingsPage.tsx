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
import { GlassCard } from "@/shared/ui/GlassCard";
import { PasswordField } from "@/shared/ui/PasswordField";
import { Spinner } from "@/shared/ui/Spinner";

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center sm:text-left">
        <h1 className="text-3xl font-semibold">Paramètres</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Personnalisez l'interface et les environnements.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="space-y-4">
          <h2 className="text-lg font-semibold">Apparence</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Thème actuel : {themeLabel(progress.theme)}
          </p>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={progress.theme === option.id ? "primary" : "secondary"}
                disabled={themeBusy !== null}
                onClick={() => {
                  setThemeBusy(option.id);
                  void updateTheme(option.id).finally(() => setThemeBusy(null));
                }}
              >
                {themeBusy === option.id ? <Spinner size="sm" /> : null}
                {option.label}
              </Button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="space-y-3">
          <h2 className="text-lg font-semibold">Environnements</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Détectez et installez Python, .NET, un compilateur C++ et le JDK.
          </p>
          <Link to="/settings/runtimes">
            <Button>Ouvrir les environnements</Button>
          </Link>
        </GlassCard>

        <GlassCard className="space-y-3 md:col-span-2">
          <h2 className="text-lg font-semibold">Aide</h2>
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

        <GlassCard className="space-y-3 md:col-span-2">
          <h2 className="text-lg font-semibold">Mises à jour</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Version installée : <span className="font-semibold text-[var(--text)]">{APP_VERSION}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void checkUpdates()} disabled={updateBusy}>
              {updateBusy && !downloadUrl ? <Spinner size="sm" /> : null}
              {updateBusy && !downloadUrl ? "Vérification…" : "Vérifier les mises à jour"}
            </Button>
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
        </GlassCard>

        <GlassCard className="space-y-3 md:col-span-2">
          <h2 className="text-lg font-semibold text-[var(--error)]">Supprimer mon compte</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            La suppression est définitive : pseudo, progression, projets et photo.
          </p>
          <Button
            variant="danger"
            disabled={deleting}
            onClick={() => {
              setDeletePassword("");
              setDeleteError(null);
              setConfirmOpen(true);
            }}
          >
            Supprimer mon compte
          </Button>
        </GlassCard>

        {dev ? (
          <GlassCard className="space-y-3 md:col-span-2">
            <h2 className="text-lg font-semibold">Logs</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Version, chemins, détection des environnements et erreurs récentes.
            </p>
            <Button variant="secondary" onClick={() => void openLogs()}>
              Logs
            </Button>
          </GlassCard>
        ) : null}
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Supprimer mon compte</h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Cette action est définitive. Votre pseudo, votre progression, vos projets
                et votre photo seront effacés. Vous ne pourrez pas récupérer ce compte.
              </p>
            </div>
            <PasswordField
              value={deletePassword}
              onChange={setDeletePassword}
              placeholder="Mot de passe"
              autoComplete="current-password"
              disabled={deleting}
            />
            {deleteError ? <p className="text-sm text-[var(--error)]">{deleteError}</p> : null}
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={deleting} onClick={() => setConfirmOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={deleting || deletePassword.length === 0}
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
