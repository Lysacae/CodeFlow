import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isDevTesting } from "@/shared/lib/devAccess";
import { devDeleteAccount, devListAccounts, devResetRank, devResetSession } from "@/shared/lib/tauri";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { apiPutProgress } from "@/shared/lib/api";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { Button } from "@/shared/ui/Button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";
import type { UserPublic } from "@/shared/lib/tauri";

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const setProgress = useProgressStore.setState;
  const [accounts, setAccounts] = useState<UserPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<UserPublic | null>(null);
  const [rankTarget, setRankTarget] = useState<UserPublic | null>(null);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setAccounts(await devListAccounts());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDevTesting(user?.username)) return;
    void load();
  }, [user?.username]);

  if (!isDevTesting(user?.username)) {
    return <Navigate to="/" replace />;
  }

  const remove = async (account: UserPublic) => {
    setBusyId(account.id);
    setError(null);
    setNotice(null);
    try {
      await devDeleteAccount(account.id);
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setPending(null);
      setNotice(`Compte ${account.username} supprimé.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const resetRank = async (account: UserPublic) => {
    setBusyId(account.id);
    setError(null);
    setNotice(null);
    try {
      await devResetRank(account.id);
      try {
        localStorage.removeItem(`cf-prog-${account.id}`);
      } catch {
        /* quota ou mode privé */
      }
      if (account.id === user?.id) {
        await useProgressionStore.getState().load(account.id);
      }
      setRankTarget(null);
      setNotice(`Rang et succès de ${account.username} réinitialisés.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const resetSession = async () => {
    setResetting(true);
    setError(null);
    setNotice(null);
    try {
      const progress = await devResetSession();
      const stamped = {
        ...progress,
        updatedAt: progress.updatedAt || new Date().toISOString(),
      };
      setProgress({ progress: stamped, ready: true });
      try {
        await apiPutProgress(stamped);
        setNotice("Session locale réinitialisée et synchronisée.");
      } catch {
        setNotice("Session locale réinitialisée. La synchro cloud a échoué.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="page">
      <div>
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="mt-2 text-[var(--text-secondary)]">Comptes enregistrés sur CodeFlow.</p>
      </div>

      <GlassCard className="space-y-3">
        <h2 className="text-lg font-semibold">Ma session</h2>
        <p className="text-sm text-[var(--text-secondary)]">
          Efface la progression locale de ce compte (leçons, exercices, historique) et la
          synchronise.
        </p>
        <Button variant="secondary" disabled={resetting} onClick={() => void resetSession()}>
          {resetting ? <Spinner size="sm" /> : null}
          Réinitialiser ma session
        </Button>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Comptes</h2>
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            Actualiser
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner label="Chargement des comptes…" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[16px] border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Pseudo</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => {
                  const self = account.id === user?.id;
                  return (
                    <tr key={account.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        <span className="font-medium">{account.username}</span>
                        {self ? (
                          <span className="ml-2 text-xs text-[var(--text-secondary)]">
                            compte actuel
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="secondary"
                            disabled={busyId === account.id}
                            onClick={() => setRankTarget(account)}
                          >
                            Rang et succès
                          </Button>
                          <Button
                            variant="danger"
                            disabled={self || busyId === account.id}
                            onClick={() => setPending(account)}
                          >
                            {busyId === account.id ? <Spinner size="sm" /> : null}
                            Supprimer
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {accounts.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[var(--text-secondary)]" colSpan={2}>
                      Aucun compte.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
        {notice ? <p className="text-sm text-[var(--success)]">{notice}</p> : null}
        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      </GlassCard>

      {rankTarget ? (
        <ConfirmDialog
          title={`Réinitialiser ${rankTarget.username}`}
          body="Êtes-vous sûr ? L'XP, le rang et les succès de ce compte seront effacés dans le cloud. Les leçons déjà terminées restent visibles, mais ne redonnent pas ces points."
          confirmLabel={busyId ? "Réinitialisation…" : "Réinitialiser"}
          danger
          busy={busyId !== null}
          onCancel={() => setRankTarget(null)}
          onConfirm={() => void resetRank(rankTarget)}
        />
      ) : null}

      {pending ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
          <GlassCard className="w-full max-w-md space-y-4">
            <h2 className="text-xl font-semibold">Supprimer {pending.username}</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Cette action retire le compte, sa progression et ses projets. Elle est définitive.
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={busyId !== null}
                onClick={() => setPending(null)}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                disabled={busyId !== null}
                onClick={() => void remove(pending)}
              >
                {busyId ? <Spinner size="sm" /> : null}
                Supprimer
              </Button>
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
