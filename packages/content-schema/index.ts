/**
 * Schéma partagé du contenu pédagogique CodeFlow.
 * La validation runtime Zod vit aussi dans apps/desktop/src/shared/lib/content.ts.
 */
export type LessonSection =
  | { type: "prose"; body: string }
  | { type: "code"; code: string };

export type ExerciseSpec = {
  id: string;
  prompt: string;
  hint?: string;
  starterCode: string;
  validate: { type: "stdoutEquals"; expected: string };
};
