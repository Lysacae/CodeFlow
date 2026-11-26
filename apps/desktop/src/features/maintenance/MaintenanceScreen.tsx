import { GlassCard } from "@/shared/ui/GlassCard";

export function MaintenanceScreen() {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <GlassCard className="w-full max-w-lg px-8 py-12 text-center">
        <p className="text-sm font-medium text-[var(--text-secondary)]">CodeFlow</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">CodeFlow est en maintenance</h1>
        <p className="mx-auto mt-4 max-w-md text-[var(--text-secondary)]">Réessayez plus tard.</p>
      </GlassCard>
    </div>
  );
}
