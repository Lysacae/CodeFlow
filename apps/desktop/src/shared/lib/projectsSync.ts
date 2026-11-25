import { apiSyncProjects, ensureStoredToken } from "@/shared/lib/api";
import { listPrograms, saveProgram, type SavedProgram } from "@/shared/lib/tauri";

/** Envoie les projets locaux vers le profil cloud et renvoie la liste fusionnée. */
export async function syncLocalProjectsToCloud(): Promise<SavedProgram[] | null> {
  const token = await ensureStoredToken();
  if (!token) return null;
  const local = await listPrograms();
  return apiSyncProjects(local);
}

export async function restoreCloudProject(project: SavedProgram): Promise<SavedProgram> {
  const saved = await saveProgram({
    id: project.id,
    name: project.name,
    language: project.language,
    fileName: project.fileName,
    code: project.code,
  });
  await syncLocalProjectsToCloud();
  return saved;
}
