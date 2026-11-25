import { useMemo, useState } from "react";
import type { LatestUpdate } from "@/shared/lib/api";
import { downloadAndRunUpdate, openUpdateUrl } from "@/shared/lib/tauri";
import { APP_VERSION } from "@/shared/lib/version";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";
import { formatUpdateNotes } from "./formatUpdateNotes";

type Props = {
  update: LatestUpdate;
  onLater: () => void;
};

export function UpdateDialog({ update, onLater }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notes = useMemo(
    () => (update.notes ? formatUpdateNotes(update.notes) : ""),
    [update.notes],
  );

  const install = async () => {
    if (!update.downloadUrl) return;
    setBusy(true);
    setError(null);
    let started = false;
    try {
      await downloadAndRunUpdate(update.downloadUrl);
      started = true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      try {
        await openUpdateUrl(update.downloadUrl);
      } catch {
        /* ignore */
      }
    } finally {
      if (!started) setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-6 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md space-y-4 text-center">
        <h2 className="text-xl font-semibold">Mise à jour disponible</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Vous avez la version {APP_VERSION}. La version {update.version} est
          disponible.
        </p>
        {notes ? (
          <div className="max-h-60 overflow-y-auto whitespace-pre-line rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm leading-5 text-[var(--text-secondary)]">
            {notes}
          </div>
        ) : null}
        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={() => void install()} disabled={busy || !update.downloadUrl}>
            {busy ? <Spinner size="sm" /> : null}
            {busy ? "Installation…" : "Installer"}
          </Button>
          {busy ? (
            <p className="w-full text-sm text-[var(--text-secondary)]">
              CodeFlow va se fermer. La nouvelle version remplace l'ancienne automatiquement.
            </p>
          ) : null}
          <Button variant="secondary" onClick={onLater} disabled={busy}>
            Plus tard
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
