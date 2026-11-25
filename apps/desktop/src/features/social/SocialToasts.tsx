import { useSocialStore } from "@/shared/store/socialStore";

export function SocialToasts() {
  const notices = useSocialStore((s) => s.notices);
  const dismissNotice = useSocialStore((s) => s.dismissNotice);
  if (notices.length === 0) return null;
  return (
    <div className="fixed bottom-4 left-4 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2">
      {notices.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => dismissNotice(item.id)}
          className="cf-toast rounded-[16px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 text-left shadow-[var(--shadow)]"
        >
          <p className="text-xs text-[var(--text-secondary)]">{item.title}</p>
          <p className="truncate text-sm font-medium">{item.body}</p>
        </button>
      ))}
    </div>
  );
}
