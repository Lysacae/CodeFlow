import type { ReactNode } from "react";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";

type Props = {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
};

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Annuler",
  danger,
  busy,
  confirmDisabled,
  onConfirm,
  onCancel,
  children,
}: Props) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {body ? <div className="mt-2 text-sm text-[var(--text-secondary)]">{body}</div> : null}
        </div>
        {children}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            disabled={busy || confirmDisabled}
            onClick={onConfirm}
          >
            {busy ? <Spinner size="sm" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
