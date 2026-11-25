import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import {
  detectRuntimes,
  installRuntime,
  uninstallRuntime,
  type RuntimeStatus,
} from "@/shared/lib/tauri";
import { useOnboardingStore } from "@/shared/store/onboardingStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";

type InstallProgress = {
  runtimeId: string;
  percent: number;
  stage: string;
  message: string;
};

type BusyAction = "install" | "uninstall";

const BULK_ID = "__bulk__";

export function RuntimesPage() {
  const navigate = useNavigate();
  const markSetupDone = useProgressStore((s) => s.markSetupDone);
  const markOnboardingDone = useOnboardingStore((s) => s.markDone);
  const setupDone = useProgressStore((s) => s.progress.setupDone);
  const [runtimes, setRuntimes] = useState<RuntimeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [softRefreshing, setSoftRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction | null>(null);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkLabel, setBulkLabel] = useState<string | null>(null);
  const bulkLock = useRef(false);

  const refresh = async (opts?: { soft?: boolean }) => {
    const soft = opts?.soft ?? false;
    if (soft) {
      setSoftRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const list = await detectRuntimes();
      setRuntimes(list);
      if (list.length > 0 && list.every((r) => r.installed)) {
        await markSetupDone();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (soft) {
        setSoftRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void markOnboardingDone();
    void refresh();
  }, [markOnboardingDone]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<InstallProgress>("runtime-install-progress", (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);

  const onInstall = async (id: string) => {
    setBusyId(id);
    setBusyAction("install");
    setMessage(null);
    setError(null);
    setProgress({
      runtimeId: id,
      percent: 2,
      stage: "resolve",
      message: "Démarrage…",
    });
    try {
      const msg = await installRuntime(id);
      setMessage(msg);
      setProgress(null);
      await refresh({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const onUninstall = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Désinstaller ${name} ? Cette action peut nécessiter des droits administrateur.`,
      )
    ) {
      return;
    }
    setBusyId(id);
    setBusyAction("uninstall");
    setMessage(null);
    setError(null);
    setProgress({
      runtimeId: id,
      percent: 2,
      stage: "resolve",
      message: "Désinstallation…",
    });
    try {
      const msg = await uninstallRuntime(id);
      setMessage(msg);
      setProgress(null);
      await refresh({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  };

  const runBulk = async (action: BusyAction, targets: RuntimeStatus[]) => {
    if (targets.length === 0 || bulkLock.current) return;
    bulkLock.current = true;
    setBusyId(BULK_ID);
    setBusyAction(action);
    setMessage(null);
    setError(null);
    const verb = action === "install" ? "Installation" : "Désinstallation";
    let completed = 0;
    try {
      for (const runtime of targets) {
        setBulkLabel(`${verb} de ${runtime.name} (${completed + 1}/${targets.length})`);
        setProgress({
          runtimeId: runtime.id,
          percent: 2,
          stage: "resolve",
          message: `${verb} de ${runtime.name}…`,
        });
        const msg = action === "install" ? await installRuntime(runtime.id) : await uninstallRuntime(runtime.id);
        completed += 1;
        setMessage(msg);
      }
      setProgress(null);
      const done =
        action === "install"
          ? completed > 1
            ? `${completed} environnements installés.`
            : null
          : completed > 1
            ? `${completed} environnements désinstallés.`
            : null;
      if (done) setMessage(done);
      await refresh({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
      if (completed > 0) {
        setMessage(
          action === "install"
            ? `${completed} environnement${completed > 1 ? "s" : ""} installé${completed > 1 ? "s" : ""} avant l'erreur.`
            : `${completed} environnement${completed > 1 ? "s" : ""} désinstallé${completed > 1 ? "s" : ""} avant l'erreur.`,
        );
      }
      await refresh({ soft: true });
    } finally {
      bulkLock.current = false;
      setBusyId(null);
      setBusyAction(null);
      setBulkLabel(null);
    }
  };

  const onInstallAll = () => {
    const targets = runtimes.filter((runtime) => !runtime.installed);
    if (targets.length === 0) return;
    void runBulk("install", targets);
  };

  const onUninstallAll = () => {
    const targets = runtimes.filter((runtime) => runtime.installed);
    if (targets.length === 0) return;
    if (!window.confirm("Désinstaller tous les environnements installés ?")) return;
    void runBulk("uninstall", targets);
  };

  const continueApp = async () => {
    await markOnboardingDone();
    await markSetupDone();
    navigate("/");
  };

  const missingCount = runtimes.filter((runtime) => !runtime.installed).length;
  const installedCount = runtimes.filter((runtime) => runtime.installed).length;
  const bulkRunning = busyId === BULK_ID;
  const progressLabel =
    bulkLabel ?? (busyAction === "uninstall" ? "Désinstallation en cours…" : "Installation en cours…");

  return (
    <div className="h-full overflow-y-auto px-6 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] text-sm font-bold text-white">
            CF
          </div>
          <div>
            <div className="font-semibold">CodeFlow</div>
            <div className="text-xs text-[var(--text-secondary)]">
              Configuration des environnements
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-semibold">Environnements de programmation</h1>
          <p className="mt-2 max-w-3xl text-[var(--text-secondary)]">
            Installation silencieuse en arrière-plan via winget. Les versions déjà
            présentes sont acceptées.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => void refresh()}
            disabled={loading || Boolean(busyId) || softRefreshing}
          >
            {loading || softRefreshing ? <Spinner size="sm" /> : null}
            Actualiser
          </Button>
          <Button
            onClick={onInstallAll}
            disabled={loading || Boolean(busyId) || softRefreshing || missingCount === 0}
          >
            {bulkRunning && busyAction === "install" ? <Spinner size="sm" /> : null}
            Installer tout
          </Button>
          <Button
            variant="danger"
            onClick={onUninstallAll}
            disabled={loading || Boolean(busyId) || softRefreshing || installedCount === 0}
          >
            {bulkRunning && busyAction === "uninstall" ? <Spinner size="sm" /> : null}
            Désinstaller tout
          </Button>
          <Button onClick={() => void continueApp()} disabled={loading || Boolean(busyId)}>
            {setupDone ? "Retour au tableau de bord" : "Continuer"}
          </Button>
        </div>

        {busyId && progress ? (
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{progressLabel}</span>
              <span className="text-[var(--text-secondary)]">{progress.percent}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary))] transition-[width] duration-300"
                style={{ width: `${Math.max(2, Math.min(100, progress.percent))}%` }}
              />
            </div>
            <p className="truncate text-xs text-[var(--text-secondary)]">
              {progress.message}
            </p>
          </GlassCard>
        ) : null}

        {message ? (
          <GlassCard className="whitespace-pre-wrap text-sm text-[var(--success)]">
            {message}
          </GlassCard>
        ) : null}
        {error ? (
          <GlassCard className="whitespace-pre-wrap text-sm text-[var(--error)]">
            {error}
          </GlassCard>
        ) : null}

        {loading && runtimes.length === 0 ? (
          <GlassCard className="py-16">
            <Spinner label="Recherche des environnements installés…" />
          </GlassCard>
        ) : (
          <div className="relative grid gap-4 md:grid-cols-2">
            {softRefreshing ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-end p-2">
                <span className="rounded-full bg-[var(--surface-strong)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                  Actualisation…
                </span>
              </div>
            ) : null}
            {runtimes.map((runtime) => (
              <GlassCard key={runtime.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{runtime.name}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {runtime.installed ? "Installé" : "Manquant"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      runtime.installed
                        ? "bg-[rgba(94,214,160,0.15)] text-[var(--success)]"
                        : "bg-[rgba(255,107,122,0.12)] text-[var(--error)]"
                    }`}
                  >
                    {runtime.installed ? "OK" : "À installer"}
                  </span>
                </div>
                {runtime.version ? (
                  <p className="text-sm text-[var(--text-secondary)]">{runtime.version}</p>
                ) : null}
                {runtime.path ? (
                  <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
                    {runtime.path}
                  </p>
                ) : null}
                {!runtime.installed ? (
                  <Button
                    onClick={() => void onInstall(runtime.id)}
                    disabled={Boolean(busyId)}
                  >
                    {busyId === runtime.id && busyAction === "install" ? (
                      <Spinner size="sm" />
                    ) : null}
                    {busyId === runtime.id && busyAction === "install"
                      ? "Installation…"
                      : "Installer"}
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => void onUninstall(runtime.id, runtime.name)}
                    disabled={Boolean(busyId)}
                  >
                    {busyId === runtime.id && busyAction === "uninstall" ? (
                      <Spinner size="sm" />
                    ) : null}
                    {busyId === runtime.id && busyAction === "uninstall"
                      ? "Désinstallation…"
                      : "Désinstaller"}
                  </Button>
                )}
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
