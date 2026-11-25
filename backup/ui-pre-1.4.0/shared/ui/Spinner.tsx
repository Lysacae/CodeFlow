import clsx from "clsx";

type Props = {
  className?: string;
  label?: string;
  size?: "sm" | "md";
};

export function Spinner({ className, label, size = "md" }: Props) {
  const dim = size === "sm" ? "h-4 w-4" : "h-9 w-9";
  return (
    <div
      className={clsx(
        label
          ? "flex flex-col items-center justify-center gap-3"
          : "inline-flex items-center justify-center",
        className,
      )}
      role="status"
    >
      <span className={clsx("cf-spin inline-flex shrink-0", dim)} aria-hidden>
        <svg className="h-full w-full" viewBox="0 0 48 48" fill="none">
          <circle
            cx="24"
            cy="24"
            r="16"
            className={size === "sm" ? "text-current" : "text-[var(--accent)]"}
            stroke="currentColor"
            strokeOpacity="0.25"
            strokeWidth="4"
          />
          <path
            d="M40 24a16 16 0 0 0-16-16"
            className={size === "sm" ? "text-current" : "text-[var(--accent)]"}
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {label ? (
        <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      ) : (
        <span className="sr-only">Chargement</span>
      )}
    </div>
  );
}
