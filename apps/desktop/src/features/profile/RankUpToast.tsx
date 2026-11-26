import { rankIcon } from "@/shared/lib/ranks";
import { useProgressionStore } from "@/shared/store/progressionStore";

export function RankUpToast() {
  const rankUps = useProgressionStore((s) => s.rankUps);
  if (rankUps.length === 0) return null;
  const item = rankUps[rankUps.length - 1];
  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-[80] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2">
      <div className="cf-toast glass flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3">
        <img src={rankIcon(item.id)} alt="" className="cf-plain-icon h-10 w-10 object-contain" />
        <div className="min-w-0 text-left">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Nouveau rang
          </p>
          <p className="mt-0.5 truncate text-base font-semibold">{item.name}</p>
        </div>
      </div>
    </div>
  );
}
