/**
 * Bascule du mode maintenance.
 * `true` : l'application livrée affiche l'écran de maintenance et bloque les parcours.
 * Remettre `false` pour rouvrir CodeFlow, puis recompiler.
 */
export const MAINTENANCE_MODE = true;

const BYPASS_KEY = "CODEFLOW_BYPASS_MAINTENANCE";

/** Dev serveur (`tauri dev` / Vite) ou drapeau local. Le build livré reste fermé. */
export function maintenanceBypassSync(): boolean {
  if (!MAINTENANCE_MODE) return true;
  if (import.meta.env.DEV) return true;
  if (import.meta.env.VITE_CODEFLOW_BYPASS_MAINTENANCE === "1") return true;
  try {
    if (localStorage.getItem(BYPASS_KEY) === "1") return true;
  } catch {
    /* stockage indisponible */
  }
  return false;
}
