import { useState } from "react";

type Props = {
  tip: string;
};

export function TipBulb({ tip }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open ? (
        <div className="max-w-xs rounded-[16px] border border-[var(--border)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)] shadow-[var(--shadow)]">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
            Indice
          </p>
          <p>{tip}</p>
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Afficher un indice"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(255,200,80,0.35)] bg-[rgba(255,200,80,0.12)] text-[var(--text)] shadow-[var(--shadow)] transition hover:scale-105"
        title="Indice"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.8c.6.5 1 1.2 1.1 2v.2h4.8v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3Z"
            stroke="#E8B84A"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
