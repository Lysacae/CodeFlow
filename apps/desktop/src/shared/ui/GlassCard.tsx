import clsx from "clsx";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  asButton?: boolean;
  delay?: number;
};

export function GlassCard({ children, className, onClick, asButton }: Props) {
  if (asButton || onClick) {
    return (
      <button type="button" onClick={onClick} className={clsx("card", "hoverable", className)}>
        {children}
      </button>
    );
  }
  return <div className={clsx("card", className)}>{children}</div>;
}
