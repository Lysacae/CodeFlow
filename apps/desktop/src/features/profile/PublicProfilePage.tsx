import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ACHIEVEMENTS, achievementIcon, rarityBorder, rarityLabel, unlockHint, type Rarity } from "@/shared/lib/achievements";
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
    <div className="mx-auto max-w-4xl space-y-6">
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
      <div className="space-y-8">
        <h2 className="text-lg font-semibold">
          Succès
          <span className="ml-2 text-sm font-normal text-[var(--text-secondary)]">
            {unlocked.size}/{ACHIEVEMENTS.length}
          </span>
        </h2>
        {(["commun", "rare", "ardu"] as Rarity[]).map((rarity) => {
          const items = ACHIEVEMENTS.filter((item) => item.rarity === rarity);
          const ownedCount = items.filter((item) => unlocked.has(item.id)).length;
          return (
            <section key={rarity} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold" style={{ color: rarityBorder(rarity) }}>
                  {rarityLabel(rarity)}
                </h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  {ownedCount}/{items.length}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((item) => {
                  const owned = unlocked.has(item.id);
                  const percent = rates[item.id] ?? 0;
                  return (
                    <div
                      key={item.id}
                      className={
                        owned
                          ? "relative flex gap-3 rounded-[16px] border border-solid bg-[var(--surface)] p-3"
                          : "relative flex gap-3 rounded-[16px] border border-dashed bg-[var(--surface)] p-3 grayscale"
                      }
                      style={{
                        borderColor: owned ? rarityBorder(item.rarity) : "var(--border)",
                        opacity: owned ? 1 : 0.45,
                      }}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={achievementIcon(item.id)}
                          alt=""
                          draggable={false}
                          className="cf-plain-icon h-12 w-12 rounded-[10px] object-contain"
                        />
                        <span
                          className={
                            owned
                              ? "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)] text-[11px] font-bold text-[#102016]"
                              : "absolute inset-0 flex items-center justify-center rounded-[10px] bg-black/55 text-sm"
                          }
                          aria-hidden
                        >
                          {owned ? "✓" : "🔒"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {item.title}
                          <span className="ml-2 text-xs text-[var(--text-secondary)]">
                            {owned ? "Obtenu" : "Verrouillé"}
                          </span>
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          {owned ? item.description : unlockHint(item)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">
                          {percent} % des utilisateurs ont obtenu ce succès !
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {me && me.id === profile.id ? (
        <ProfileModal open={editOpen} onClose={() => setEditOpen(false)} />
      ) : null}
    </div>
  );
}
