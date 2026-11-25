import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ACHIEVEMENTS, achievementIcon, rarityLabel, unlockHint } from "@/shared/lib/achievements";
import { apiPublicProfile, type PublicProfile } from "@/shared/lib/api";
import { countLessons } from "@/shared/lib/content";
import { rankById, rankIcon, rankProgress } from "@/shared/lib/ranks";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { useSocialStore } from "@/shared/store/socialStore";
import { ProfileModal } from "@/features/auth/ProfileModal";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";

export function PublicProfilePage() {
  const { userId = "" } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const rates = useProgressionStore((s) => s.rates);
  const record = useProgressionStore((s) => s.record);
  const blocked = useSocialStore((s) => s.snapshot.blocked);
  const blockUser = useSocialStore((s) => s.blockUser);
  const unblockUser = useSocialStore((s) => s.unblockUser);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError(null);
    void apiPublicProfile(userId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    if (me && me.id !== userId) record({ visitedProfile: true });
    return () => {
      cancelled = true;
    };
  }, [userId, me?.id, record]);

  if (error) {
    return (
      <GlassCard>
        <p>{error}</p>
        <Button className="mt-4" onClick={() => navigate(-1)}>Retour</Button>
      </GlassCard>
    );
  }
  if (!profile) {
    return (
      <GlassCard className="py-16">
        <Spinner label="Chargement du profil…" />
      </GlassCard>
    );
  }

  const rank = rankById(profile.rankId);
  const progress = rankProgress(profile.xp);
  const unlocked = new Set(profile.achievements);
  const totalLessons = countLessons();
  const lessonPercent = totalLessons ? Math.min(100, Math.round((profile.lessons / totalLessons) * 100)) : 0;

  return (
    <div className="page">
      <button type="button" className="cursor-pointer text-sm text-[var(--text-secondary)]" onClick={() => navigate(-1)}>
        ← Retour
      </button>
      <GlassCard>
        <div className="flex flex-wrap items-center gap-4">
          {profile.avatarData ? (
            <img src={profile.avatarData} alt="" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-strong)] text-xl">
              {profile.username.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{profile.username}</h1>
              {me && me.id === profile.id ? (
                <button
                  type="button"
                  className="cursor-pointer rounded-[10px] px-2 py-1 text-lg leading-none hover:bg-[var(--surface-strong)]"
                  title="Modifier le profil"
                  aria-label="Modifier le profil"
                  onClick={() => setEditOpen(true)}
                >
                  ✏️
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Niveau {profile.level} · {profile.xp} XP
              {progress.nextName ? ` · prochain rang : ${progress.nextName}` : " · rang maximal"}
            </p>
            <div className="mt-2 h-2 max-w-xs overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <img src={rankIcon(rank.id)} alt="" className="cf-plain-icon h-12 w-12 object-contain" />
            <div>
              <p className="text-xs text-[var(--text-secondary)]">Rang</p>
              <p className="font-medium">{rank.name}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          {profile.lessons} leçons ({lessonPercent} %) · {profile.exercises} exercices · {profile.qaMastered} questions maîtrisées
          {profile.qaComplete ? " · séries Q/R terminées" : ""}
        </p>
        {me && me.id !== profile.id ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {blocked.some((person) => person.id === profile.id) ? (
              <Button
                variant="ghost"
                onClick={() =>
                  void unblockUser(profile.id)
                    .then(() => setNotice(`${profile.username} a été débloqué.`))
                    .catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
                }
              >
                Débloquer
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() =>
                  void blockUser(profile.id)
                    .then(() => setNotice(`${profile.username} a été bloqué.`))
                    .catch((e) => setActionError(e instanceof Error ? e.message : String(e)))
                }
              >
                Bloquer
              </Button>
            )}
            <Button variant="ghost" onClick={() => setNotice("Signalement envoyé. Merci.")}>
              Signaler
            </Button>
            {notice ? <span className="text-sm text-[var(--success)]">{notice}</span> : null}
            {actionError ? <span className="text-sm text-[var(--error)]">{actionError}</span> : null}
          </div>
        ) : null}
      </GlassCard>
      <div>
        <h2 className="text-lg font-semibold">Succès</h2>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((item) => {
            const owned = unlocked.has(item.id);
            const percent = rates[item.id] ?? 0;
            return (
              <div key={item.id} className={`ach ${item.rarity} ${owned ? "got" : "locked"}`}>
                <div className="ach-ico">
                  <img className="px" src={achievementIcon(item.id)} alt="" width={64} height={64} />
                </div>
                <div className="ach-meta">
                  <div className="row gap-2">
                    <b>{item.title}</b>
                    <span className={`badge ${item.rarity}`}>{rarityLabel(item.rarity)}</span>
                  </div>
                  <p>{owned ? item.description : unlockHint(item)}</p>
                  <span className="ach-pct">{percent} % des utilisateurs ont obtenu ce succès</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {me && me.id === profile.id ? (
        <ProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
      ) : null}
    </div>
  );
}
