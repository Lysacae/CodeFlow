import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  getLanguage,
  getQuiz,
  getTrack,
  isChapterComplete,
  languageAccentVar,
} from "@/shared/lib/content";
import { formatDuration, normalizeQa, qaAccuracy } from "@/shared/lib/quiz";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { isDevTesting } from "@/shared/lib/devAccess";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Button } from "@/shared/ui/Button";
import { LessonProgressBar } from "@/shared/ui/LessonProgressBar";

export function PathPage() {
  const { languageId = "" } = useParams();
  const navigate = useNavigate();
  const progress = useProgressStore((s) => s.progress);
  const dev = isDevTesting(useAuthStore((s) => s.user?.username));
  const openTutorial = useProgressionStore((s) => s.openTutorial);
  const [openChapters, setOpenChapters] = useState<Record<string, number[]>>({});
  const language = getLanguage(languageId);
  const track = getTrack(languageId);

  if (!language || !track) {
    return (
      <GlassCard>
        <p>Parcours introuvable.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>
          Retour
        </Button>
      </GlassCard>
    );
  }

  const chapter1Done = isChapterComplete(
    languageId,
    1,
    progress.completedLessons,
  );

  const isLevelUnlocked = (levelIndex: number) => {
    const level = track.levels[levelIndex];
    const chapter = level.chapter ?? 1;
    if (chapter > 1 && !chapter1Done) return false;
    if (levelIndex === 0) return true;
    if (level.lessons.some((l) => progress.completedLessons.includes(l.id))) {
      return true;
    }
    // Premier niveau d'un nouveau chapitre
    const prev = track.levels[levelIndex - 1];
    if ((prev.chapter ?? 1) < chapter) {
      return chapter1Done;
    }
    return prev.lessons.every((lesson) =>
      progress.completedLessons.includes(lesson.id),
    );
  };

  const chapters = Array.from(
    new Set(track.levels.map((l) => l.chapter ?? 1)),
  ).sort((a, b) => a - b);

  const quiz = getQuiz(languageId);
  const qaState = normalizeQa(progress.qa?.[languageId], quiz?.questions.length ?? 0);
  const quizDone = Boolean(quiz) && qaState.correctIds.length >= (quiz?.questions.length ?? 1);
  const accent = languageAccentVar(language.id);
  const allLessons = track.levels.flatMap((level) => level.lessons);
  const langDone = allLessons.filter((lesson) =>
    progress.completedLessons.includes(lesson.id),
  ).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 text-center sm:text-left">
        <div className="w-full sm:w-auto">
          <Link to="/" className="cursor-pointer text-sm text-[var(--text-secondary)] hover:text-[var(--text)]">
            ← Tableau de bord
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <img src={`/logos/${language.id}.png`} alt="" className="h-10 w-10 object-contain" />
            <h1 className="text-3xl font-semibold">{language.name}</h1>
          </div>
          <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">{language.tagline}</p>
          <div className="mt-4 max-w-md space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Progression du parcours</span>
              <span>
                {langDone}/{allLessons.length} leçons
              </span>
            </div>
            <LessonProgressBar
              value={langDone}
              max={allLessons.length}
              accent={accent}
              label={`Progression ${language.name}`}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => openTutorial(languageId)}>
            Tutoriel
          </Button>
        <div
          className="rounded-[18px] px-4 py-3 text-sm"
          style={{
            background: `color-mix(in srgb, ${languageAccentVar(language.id)} 18%, transparent)`,
            border: `1px solid color-mix(in srgb, ${languageAccentVar(language.id)} 35%, transparent)`,
          }}
        >
          Extension {language.extension}
        </div>
        </div>
      </div>

      {quiz ? (
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Questions / Réponses</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {qaState.correctIds.length}/{quiz.questions.length} maîtrisées
                {qaState.attempts > 0 ? ` · ${qaAccuracy(qaState)} % de bonnes réponses` : ""}
                {qaState.completionMs != null
                  ? ` · terminé en ${formatDuration(qaState.completionMs)}`
                  : qaState.timeSpentMs > 0
                    ? ` · ${formatDuration(qaState.timeSpentMs)}`
                    : " · 25 secondes par question"}
              </p>
            </div>
            <Button onClick={() => navigate(`/learn/${languageId}/quiz`)}>
              {quizDone ? "Voir le résultat" : qaState.attempts > 0 ? "Continuer" : "Commencer"}
            </Button>
          </div>
        </GlassCard>
      ) : null}

      {chapters.map((chapter) => {
        const chapterLevels = track.levels.filter(
          (l) => (l.chapter ?? 1) === chapter,
        );
        const lockedChapter = !dev && chapter > 1 && !chapter1Done;
        const preferred =
          progress.lastLanguage === languageId && progress.lastLessonId
            ? (track.levels.find((level) =>
                level.lessons.some((lesson) => lesson.id === progress.lastLessonId),
              )?.chapter ?? chapters[0] ?? 1)
            : (chapters[0] ?? 1);
        const opened = openChapters[languageId] ?? [preferred];
        const isOpen = opened.includes(chapter);
        const lessonTotal = chapterLevels.reduce((sum, level) => sum + level.lessons.length, 0);
        const lessonDone = chapterLevels.reduce(
          (sum, level) =>
            sum + level.lessons.filter((lesson) => progress.completedLessons.includes(lesson.id)).length,
          0,
        );
        const toggle = () => {
          setOpenChapters((current) => {
            const list = current[languageId] ?? [preferred];
            const next = list.includes(chapter)
              ? list.filter((item) => item !== chapter)
              : [...list, chapter];
            return { ...current, [languageId]: next };
          });
        };

        return (
          <section
            key={chapter}
            className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]"
          >
            <button
              type="button"
              onClick={toggle}
              aria-expanded={isOpen}
              className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-[var(--surface-strong)]"
            >
              <span className="flex w-full items-center justify-between gap-3">
              <span>
                <span className="block text-lg font-semibold">
                  Chapitre {chapter}
                  {lockedChapter ? " · verrouillé" : ""}
                </span>
                <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                  {lessonDone}/{lessonTotal} leçons
                  {lockedChapter ? " · terminez le chapitre 1 pour débloquer" : ""}
                </span>
              </span>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
                className={clsx(
                  "h-5 w-5 shrink-0 text-[var(--text-secondary)] transition",
                  isOpen && "rotate-180",
                )}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
              </span>
              <LessonProgressBar
                value={lessonDone}
                max={lessonTotal}
                accent={accent}
                label={`Chapitre ${chapter}`}
              />
            </button>

            {isOpen ? (
              <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
            {chapterLevels.map((level) => {
              const levelIndex = track.levels.findIndex((l) => l.id === level.id);
              const unlocked = dev || (!lockedChapter && isLevelUnlocked(levelIndex));
              const completedCount = level.lessons.filter((l) =>
                progress.completedLessons.includes(l.id),
              ).length;

              return (
                <GlassCard key={level.id} delay={levelIndex * 0.03}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)]">
                        Niveau {level.id}
                        {!unlocked ? " · verrouillé" : ""}
                      </p>
                      <h3 className="text-lg font-semibold">{level.title}</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {level.summary}
                      </p>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {completedCount}/{level.lessons.length}
                    </p>
                  </div>
                  <div className="mt-3">
                    <LessonProgressBar
                      value={completedCount}
                      max={level.lessons.length}
                      accent={accent}
                      label={level.title}
                    />
                  </div>

                  <div className="mt-4 grid gap-2">
                    {level.lessons.map((lesson, lessonIndex) => {
                      const done = progress.completedLessons.includes(lesson.id);
                      const previousDone =
                        lessonIndex === 0 ||
                        progress.completedLessons.includes(
                          level.lessons[lessonIndex - 1].id,
                        );
                      const canOpen =
                        dev || (unlocked && (done || previousDone || lessonIndex === 0));
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          disabled={!canOpen}
                          onClick={() =>
                            navigate(`/learn/${languageId}/lesson/${lesson.id}`)
                          }
                          className="flex flex-col rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:bg-[var(--surface-strong)] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <span className="flex w-full items-center justify-between gap-3">
                            <span>
                              <span className="block font-medium">{lesson.title}</span>
                              <span className="text-xs text-[var(--text-secondary)]">
                                {lesson.exercise
                                  ? "Cours + exercice"
                                  : lesson.kind === "file-wizard"
                                    ? "Création de fichier"
                                    : "Cours"}
                              </span>
                            </span>
                            <span className="text-xs text-[var(--text-secondary)]">
                              {done ? "Terminé" : canOpen ? "Ouvrir" : "Verrouillé"}
                            </span>
                          </span>
                          <span className="mt-2 block w-full">
                            <LessonProgressBar
                              value={done ? 1 : 0}
                              max={1}
                              accent={accent}
                              label={lesson.title}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </GlassCard>
              );
            })}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
