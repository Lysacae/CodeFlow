import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiLeaderboard, type LeaderboardEntry } from "@/shared/lib/api";
import { rankById, rankIcon } from "@/shared/lib/ranks";
import { countLessons } from "@/shared/lib/content";
import { formatDuration } from "@/shared/lib/quiz";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";

type BoardTab = "progress" | "time";

const tabs: { id: BoardTab; label: string }[] = [
  { id: "progress", label: "Progression" },
  { id: "time", label: "Speedrun Q/A" },
];

const REFRESH_COOLDOWN_MS = 30_000;

export function LeaderboardPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const record = useProgressionStore((s) => s.record);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<BoardTab>("progress");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [cooldownNotice, setCooldownNotice] = useState(false);
  const totalLessons = countLessons();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await apiLeaderboard();
        if (!cancelled) setEntries(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    record({ leaderboard: true });
    return () => {
      cancelled = true;
    };
  }, [record]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (next >= cooldownUntil) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const remaining = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  const refresh = async () => {
    const wait = cooldownUntil - Date.now();
    if (wait > 0) {
      setNow(Date.now());
      setCooldownNotice(true);
      return;
    }
    setRefreshing(true);
    setCooldownNotice(false);
    setError(null);
    try {
      const list = await apiLeaderboard();
      setEntries(list);
      setCooldownUntil(Date.now() + REFRESH_COOLDOWN_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  };

  const ranked = useMemo(() => {
    const copy = [...entries];
    if (tab === "time") {
      copy.sort((a, b) => {
        const completeA = Boolean(a.qaComplete);
        const completeB = Boolean(b.qaComplete);
        if (completeA !== completeB) return completeA ? -1 : 1;
        if (completeA && completeB) return (a.qaTimeMs ?? 0) - (b.qaTimeMs ?? 0);
        return (b.qaMastered ?? 0) - (a.qaMastered ?? 0);
      });
    }
    return copy;
  }, [entries, tab]);

  const intro =
    tab === "time"
      ? "Speedrun Q/A : temps pour terminer toutes les séries. Le plus rapide est devant."
      : "Progression des apprenants CodeFlow, triée par leçons et exercices validés.";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Classement</h1>
          <p className="mt-2 text-[var(--text-secondary)]">{intro}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            aria-label="Recharger le classement"
            title={remaining > 0 ? `Patientez ${remaining} s` : "Recharger le classement"}
            onClick={() => void refresh()}
            disabled={loading || refreshing}
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border)] text-[var(--text-secondary)] transition hover:bg-[var(--surface)] hover:text-[var(--text)] disabled:opacity-50"
          >
            {refreshing ? (
              <Spinner size="sm" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                <path
                  d="M20 12a8 8 0 0 1-13.66 5.66"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M4 12a8 8 0 0 1 13.66-5.66"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M20 5v5h-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 19v-5h5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          {cooldownNotice && remaining > 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">Patientez {remaining} s</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={
              tab === item.id
                ? "rounded-[14px] bg-[var(--surface-strong)] px-4 py-2 text-sm font-medium text-[var(--text)]"
                : "rounded-[14px] border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)]"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <GlassCard className="py-16">
          <Spinner label="Chargement du classement…" />
        </GlassCard>
      ) : null}

      {error ? <GlassCard className="text-sm text-[var(--error)]">{error}</GlassCard> : null}

      {!loading && !error ? (
        <GlassCard className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Apprenant</th>
                  {tab === "progress" ? (
                    <>
                      <th className="px-4 py-3 font-medium">Leçons</th>
                      <th className="px-4 py-3 font-medium">Exercices</th>
                      <th className="px-4 py-3 font-medium">Progression</th>
                    </>
                  ) : null}
                  {tab === "time" ? (
                    <>
                      <th className="px-4 py-3 font-medium">Temps</th>
                      <th className="px-4 py-3 font-medium">Série</th>
                    </>
                  ) : null}
                  <th className="px-4 py-3 text-right font-medium">Rang</th>
                </tr>
              </thead>
              <tbody>
                {ranked.length === 0 ? (
                  <tr>
                    <td colSpan={tab === "progress" ? 6 : 5} className="px-4 py-10 text-center text-[var(--text-secondary)]">
                      Aucun joueur pour le moment.
                    </td>
                  </tr>
                ) : (
                  ranked.map((entry, index) => {
                    const isMe = currentUser?.id === entry.id;
                    const percent = totalLessons
                      ? Math.min(100, Math.round((entry.lessons / totalLessons) * 100))
                      : 0;
                    return (
                      <tr
                        key={entry.id}
                        onClick={() => navigate(`/profil/${entry.id}`)}
                        className={
                          isMe
                            ? "cursor-pointer border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
                            : "cursor-pointer border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)]"
                        }
                      >
                        <td className="px-4 py-3 font-semibold tabular-nums">{index + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {entry.avatarData ? (
                              <img
                                src={entry.avatarData}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-strong)] text-xs font-medium">
                                {entry.username.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                            <div className="font-medium text-[var(--text)]">
                              {entry.username}
                              {isMe ? (
                                <span className="ml-2 text-xs text-[var(--accent)]">(vous)</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        {tab === "progress" ? (
                          <>
                            <td className="px-4 py-3 tabular-nums">{entry.lessons}</td>
                            <td className="px-4 py-3 tabular-nums">{entry.exercises}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="h-2 w-24 overflow-hidden rounded-full bg-[var(--surface-strong)]">
                                  <div
                                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary))]"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                                <span className="tabular-nums text-[var(--text-secondary)]">
                                  {percent}%
                                </span>
                              </div>
                            </td>
                          </>
                        ) : null}
                        {tab === "time" ? (
                          <>
                            <td className="px-4 py-3 tabular-nums">
                              {entry.qaComplete ? formatDuration(entry.qaTimeMs ?? 0) : "—"}
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                              {entry.qaComplete ? "Terminée" : "En cours"}
                            </td>
                          </>
                        ) : null}
                        <td className="px-4 py-3 text-right">
                          <img
                            src={rankIcon(rankById(entry.rankId).id)}
                            alt=""
                            title={rankById(entry.rankId).name}
                            className="cf-plain-icon ml-auto h-7 w-7 object-contain"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}
    </div>
  );
}
