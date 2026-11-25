import { z } from "zod";
import { assertChecksCompile, exerciseChecksSchema } from "@/shared/lib/exerciseChecks";
import languagesJson from "@content/languages.json";
import pythonTrack from "@content/tracks/python/track.json";
import csharpTrack from "@content/tracks/csharp/track.json";
import cppTrack from "@content/tracks/cpp/track.json";
import javaTrack from "@content/tracks/java/track.json";
import pythonQuiz from "@content/tracks/python/quiz.json";
import csharpQuiz from "@content/tracks/csharp/quiz.json";
import cppQuiz from "@content/tracks/cpp/quiz.json";
import javaQuiz from "@content/tracks/java/quiz.json";

const sectionSchema = z.object({
  type: z.enum(["prose", "code"]),
  heading: z.string().optional(),
  body: z.string().optional(),
  code: z.string().optional(),
});

const exerciseSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  hint: z.string().optional(),
  objective: z.string().optional(),
  concept: z.string().optional(),
  starterCode: z.string(),
  validate: z.object({
    type: z.literal("stdoutEquals"),
    expected: z.string(),
    checks: exerciseChecksSchema.optional(),
  }),
});

const fileWizardSchema = z.object({
  defaultName: z.string(),
  extension: z.string(),
  starterCode: z.string(),
  notes: z.array(z.string()).optional(),
  requireClassNameMatch: z.boolean().optional(),
});

const lessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["lesson", "file-wizard"]).optional(),
  sections: z.array(sectionSchema),
  exercise: exerciseSchema.optional(),
  fileWizard: fileWizardSchema.optional(),
});

const levelSchema = z.object({
  id: z.number(),
  title: z.string(),
  summary: z.string(),
  chapter: z.number().default(1),
  lessons: z.array(lessonSchema),
});

const trackSchema = z.object({
  language: z.string(),
  levels: z.array(levelSchema),
});

const languageSchema = z.object({
  id: z.string(),
  name: z.string(),
  tagline: z.string(),
  extension: z.string(),
  accent: z.string(),
  monaco: z.string(),
  runtimeId: z.string(),
});

const quizQuestionSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  choices: z.array(z.string()).min(2),
  answer: z.number().int().nonnegative(),
  explanation: z.string(),
});

const quizSchema = z.object({
  language: z.string(),
  secondsPerQuestion: z.number().int().positive().default(25),
  questions: z.array(quizQuestionSchema).min(20),
});

export type Section = z.infer<typeof sectionSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Lesson = z.infer<typeof lessonSchema>;
export type Level = z.infer<typeof levelSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Language = z.infer<typeof languageSchema>;
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;
export type Quiz = z.infer<typeof quizSchema>;

export const languages: Language[] = z
  .object({ languages: z.array(languageSchema) })
  .parse(languagesJson).languages;

export const tracks: Record<string, Track> = {
  python: trackSchema.parse(pythonTrack),
  csharp: trackSchema.parse(csharpTrack),
  cpp: trackSchema.parse(cppTrack),
  java: trackSchema.parse(javaTrack),
};

export const quizzes: Record<string, Quiz> = {
  python: quizSchema.parse(pythonQuiz),
  csharp: quizSchema.parse(csharpQuiz),
  cpp: quizSchema.parse(cppQuiz),
  java: quizSchema.parse(javaQuiz),
};

export function getLanguage(id: string): Language | undefined {
  return languages.find((l) => l.id === id);
}

export function getTrack(languageId: string): Track | undefined {
  return tracks[languageId];
}

export function getQuiz(languageId: string): Quiz | undefined {
  return quizzes[languageId];
}

export function countQuizQuestions(): number {
  return Object.values(quizzes).reduce((sum, quiz) => sum + quiz.questions.length, 0);
}

export function findLesson(
  languageId: string,
  lessonId: string,
): { level: Level; lesson: Lesson; levelIndex: number; lessonIndex: number } | null {
  const track = getTrack(languageId);
  if (!track) return null;
  for (let li = 0; li < track.levels.length; li++) {
    const level = track.levels[li];
    const lessonIndex = level.lessons.findIndex((l) => l.id === lessonId);
    if (lessonIndex >= 0) {
      return { level, lesson: level.lessons[lessonIndex], levelIndex: li, lessonIndex };
    }
  }
  return null;
}

export function getAllLessons(languageId: string): Lesson[] {
  const track = getTrack(languageId);
  if (!track) return [];
  return track.levels.flatMap((level) => level.lessons);
}

export function getNextLesson(
  languageId: string,
  lessonId: string,
): Lesson | null {
  const all = getAllLessons(languageId);
  const idx = all.findIndex((l) => l.id === lessonId);
  if (idx < 0 || idx >= all.length - 1) return null;
  return all[idx + 1];
}

export function countLessons(): number {
  return Object.values(tracks).reduce(
    (acc, track) => acc + track.levels.reduce((a, l) => a + l.lessons.length, 0),
    0,
  );
}

export function languageAccentVar(id: string): string {
  switch (id) {
    case "python":
      return "var(--python)";
    case "csharp":
      return "var(--csharp)";
    case "cpp":
      return "var(--cpp)";
    case "java":
      return "var(--java)";
    default:
      return "var(--accent)";
  }
}

export function isChapterComplete(
  languageId: string,
  chapter: number,
  completedLessons: string[],
): boolean {
  const track = getTrack(languageId);
  if (!track) return false;
  const lessons = track.levels
    .filter((l) => (l.chapter ?? 1) === chapter)
    .flatMap((l) => l.lessons);
  if (lessons.length === 0) return false;
  return lessons.every((lesson) => completedLessons.includes(lesson.id));
}

if (languages.length !== 4) {
  throw new Error("CodeFlow attend exactement 4 langages.");
}
for (const language of languages) {
  const track = tracks[language.id];
  if (!track || track.levels.length < 8) {
    throw new Error(`Parcours incomplet pour ${language.id}.`);
  }
  if (!track.levels.some((level) => level.chapter === 3)) {
    throw new Error(`Chapitre 3 manquant pour ${language.id}.`);
  }
  const quiz = quizzes[language.id];
  if (!quiz) {
    throw new Error(`Questions manquantes pour ${language.id}.`);
  }
  for (const question of quiz.questions) {
    if (question.answer >= question.choices.length) {
      throw new Error(`Réponse invalide : ${question.id}`);
    }
  }
  for (const level of track.levels) {
    for (const lesson of level.lessons) {
      if (!lesson.exercise?.validate.checks) continue;
      try {
        assertChecksCompile(lesson.exercise.validate.checks);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Vérification invalide (${lesson.exercise.id}) : ${detail}`);
      }
    }
  }
}
