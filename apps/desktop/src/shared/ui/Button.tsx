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
        "inline-flex h-[42px] items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" &&
          "bg-[var(--accent)] text-[var(--text-on-accent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_40%,transparent),0_8px_30px_-8px_color-mix(in_srgb,var(--accent)_60%,transparent)] hover:brightness-110",
        variant === "secondary" &&
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-strong)]",
        variant === "ghost" &&
          "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
        variant === "danger" &&
          "border border-[color-mix(in_srgb,var(--error)_25%,transparent)] bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_20%,transparent)]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
