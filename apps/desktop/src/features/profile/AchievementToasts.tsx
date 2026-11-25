import { achievementIcon } from "@/shared/lib/achievements";
import { useProgressionStore } from "@/shared/store/progressionStore";

export function AchievementToasts() {
  const unlocks = useProgressionStore((s) => s.unlocks);
  if (unlocks.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col gap-2">
      {unlocks.map((item) => (
        <div
          key={item.key}
          className="cf-toast flex items-center gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 shadow-[var(--shadow)]"
        >
          <img src={achievementIcon(item.id)} alt="" className="cf-plain-icon h-10 w-10 shrink-0 rounded-[8px] object-contain" />
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-secondary)]">Succès débloqué</p>
            <p className="truncate text-sm font-medium">{item.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
