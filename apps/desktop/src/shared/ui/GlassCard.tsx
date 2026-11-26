import clsx from "clsx";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  asButton?: boolean;
  delay?: number;
};

export function GlassCard({
  children,
  className,
  onClick,
  asButton,
  delay = 0,
}: Props) {
  const Comp = asButton || onClick ? motion.button : motion.div;
  return (
    <Comp
      type={asButton || onClick ? "button" : undefined}
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={onClick ? { y: -2, scale: 1.01 } : undefined}
      className={clsx(
        "glass rounded-[var(--radius-lg)] p-5 text-left",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </Comp>
  );
}
