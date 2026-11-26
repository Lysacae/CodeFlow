import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ACHIEVEMENTS, RARITY_XP, rarityLabel } from "@/shared/lib/achievements";
import { isDevTesting } from "@/shared/lib/devAccess";
import {
  devDeleteAccount,
  devGetProgression,
  devListAccounts,
  devResetRank,
  devResetSession,
  devUnlockAchievements,
} from "@/shared/lib/tauri";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { apiPutProgress } from "@/shared/lib/api";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { Button } from "@/shared/ui/Button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";
import type { UserPublic } from "@/shared/lib/tauri";

const ACHIEVEMENT_XP = Object.fromEntries(
  ACHIEVEMENTS.map((item) => [item.id, RARITY_XP[item.rarity]]),
) as Record<string, number>;

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
  const [grantUserId, setGrantUserId] = useState("");
  const [grantQuery, setGrantQuery] = useState("");
  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [grantLoading, setGrantLoading] = useState(false);

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

  useEffect(() => {
    if (!grantUserId && accounts[0]) setGrantUserId(accounts[0].id);
  }, [accounts, grantUserId]);

  useEffect(() => {
    if (!isDevTesting(user?.username) || !grantUserId) return;
    let cancelled = false;
    setGrantLoading(true);
    void devGetProgression(grantUserId)
      .then((raw) => {
        if (cancelled) return;
        const list = (raw as { achievements?: unknown })?.achievements;
        setOwnedIds(
          Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [],
        );
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setGrantLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [grantUserId, user?.username]);

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

  const readOwned = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return [];
    const list = (raw as { achievements?: unknown }).achievements;
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
  };

  const resetRank = async (account: UserPublic) => {
    setBusyId(account.id);
    setError(null);
    setNotice(null);
    try {
      const saved = await devResetRank(
        account.id,
        ACHIEVEMENTS.map((item) => item.id),
      );
      try {
        localStorage.removeItem(`cf-prog-${account.id}`);
      } catch {
        /* quota ou mode privé */
      }
      if (account.id === user?.id) {
        await useProgressionStore.getState().adopt(saved);
      }
      if (grantUserId === account.id) setOwnedIds([]);
      setRankTarget(null);
      setNotice(`Rang et succès de ${account.username} réinitialisés.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const unlockIds = async (ids: string[]) => {
    const account = accounts.find((item) => item.id === grantUserId);
    if (!account || ids.length === 0) return;
    setBusyId(account.id);
    setError(null);
    setNotice(null);
    try {
      const saved = await devUnlockAchievements(account.id, ids, ACHIEVEMENT_XP);
      if (account.id === user?.id) {
        await useProgressionStore.getState().adopt(saved);
      }
      setOwnedIds(readOwned(saved));
      setNotice(
        ids.length === 1
          ? `Succès débloqué pour ${account.username}.`
          : `${ids.length} succès débloqués pour ${account.username}.`,
      );
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

  const ownedSet = new Set(ownedIds);
  const query = grantQuery.trim().toLowerCase();
  const filtered = ACHIEVEMENTS.filter((item) => {
    if (!query) return true;
    return (
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      rarityLabel(item.rarity).toLowerCase().includes(query)
    );
  });
  const filteredLocked = filtered.filter((item) => !ownedSet.has(item.id));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

      <GlassCard className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Succès</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Débloque un succès, ceux de la recherche, ou toute la liste.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={grantUserId}
            onChange={(event) => setGrantUserId(event.target.value)}
            className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.username}
              </option>
            ))}
          </select>
          <input
            value={grantQuery}
            onChange={(event) => setGrantQuery(event.target.value)}
            placeholder="Rechercher un succès"
            className="min-w-[14rem] flex-1 rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={!grantUserId || busyId !== null || filteredLocked.length === 0}
            onClick={() => void unlockIds(filteredLocked.map((item) => item.id))}
          >
            Débloquer les résultats
          </Button>
          <Button
            disabled={!grantUserId || busyId !== null}
            onClick={() => void unlockIds(ACHIEVEMENTS.map((item) => item.id))}
          >
            Tout débloquer
          </Button>
        </div>
        {grantLoading ? (
          <div className="flex justify-center py-4">
            <Spinner size="sm" />
          </div>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {filtered.map((item) => {
              const owned = ownedSet.has(item.id);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {item.title}
                      <span className="ml-2 text-xs text-[var(--text-secondary)]">
                        {rarityLabel(item.rarity)}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">{item.description}</p>
                  </div>
                  {owned ? (
                    <span className="shrink-0 text-xs text-[var(--success)]">Obtenu</span>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={busyId !== null}
                      onClick={() => void unlockIds([item.id])}
                    >
                      Débloquer
                    </Button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Aucun succès ne correspond.</p>
            ) : null}
          </div>
        )}
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
