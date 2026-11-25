type Props = {
  value: number;
  max: number;
  accent?: string;
  label?: string;
};

/** Barre fine : leçons terminées sur le total du parcours, du chapitre ou de la leçon. */
export function LessonProgressBar({
  value,
  max,
  accent = "var(--accent)",
  label,
}: Props) {
  const safeMax = max > 0 ? max : 0;
  const ratio = safeMax === 0 ? 0 : Math.max(0, Math.min(1, value / safeMax));
  const percent = Math.round(ratio * 100);

  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_85%,transparent)]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label ?? `Progression ${percent} %`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%`, background: accent }}
      />
    </div>
  );
}
