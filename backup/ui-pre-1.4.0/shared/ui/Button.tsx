import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  children: ReactNode;
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-[var(--accent)] text-white shadow-[0_10px_30px_rgba(108,140,255,0.35)] hover:brightness-110",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-strong)]",
        variant === "ghost" &&
          "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
        variant === "danger" &&
          "bg-[rgba(255,107,122,0.15)] text-[var(--error)] hover:bg-[rgba(255,107,122,0.25)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
