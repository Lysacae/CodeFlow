export function MaintenanceScreen() {
  return (
    <div className="relative z-[1] flex h-full w-full items-center justify-center px-6">
      <section className="cf-maint glass w-full max-w-lg px-8 py-12 text-center">
        <p className="cf-kicker">CodeFlow</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">CodeFlow est en maintenance</h1>
        <p className="mx-auto mt-4 max-w-md text-[var(--text-secondary)]">
          L'interface est en cours de refonte.
        </p>
        <p className="mx-auto mt-2 max-w-md text-[var(--text-secondary)]">Réessayez plus tard.</p>
      </section>
    </div>
  );
}
