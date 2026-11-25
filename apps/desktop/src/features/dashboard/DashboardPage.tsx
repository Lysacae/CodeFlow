import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  countLessons,
  findLesson,
  getAllLessons,
  getLanguage,
  languageAccentVar,
  languages,
} from "@/shared/lib/content";
import { useProgressStore } from "@/shared/store/progressStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { LessonProgressBar } from "@/shared/ui/LessonProgressBar";
import { ProgressRing } from "@/shared/ui/ProgressRing";

export function DashboardPage() {
  const navigate = useNavigate();
  const progress = useProgressStore((s) => s.progress);

  const totalLessons = countLessons();
  const completed = progress.completedLessons.length;
  const percent = totalLessons ? (completed / totalLessons) * 100 : 0;
  const hasStarted =
    Boolean(progress.lastLessonId && progress.lastLanguage) ||
    progress.completedLessons.length > 0;

  const last = useMemo(() => {
    if (!progress.lastLessonId || !progress.lastLanguage) return null;
    const found = findLesson(progress.lastLanguage, progress.lastLessonId);
    const lang = getLanguage(progress.lastLanguage);
    if (!found || !lang) return null;
    return { ...found, lang };
  }, [progress.lastLessonId, progress.lastLanguage]);

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]"
      >
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(108,140,255,0.18),transparent_45%)]" />
          <div className="relative space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">Tableau de bord</p>
            <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-[var(--text)] md:text-4xl">
              {hasStarted
                ? "Poursuivez votre apprentissage avec méthode."
                : "Commencez votre apprentissage."}
            </h1>
            <p className="max-w-2xl text-[var(--text-secondary)]">
              Choisissez un langage ci-dessous, suivez un parcours progressif, exécutez
              votre code et créez votre premier fichier.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {hasStarted ? (
                <Button
                  onClick={() => {
                    if (last) {
                      navigate(`/learn/${last.lang.id}/lesson/${last.lesson.id}`);
                    } else {
                      navigate("/learn/python");
                    }
                  }}
                >
                  Reprendre l'apprentissage
                </Button>
              ) : (
                <Button disabled title="Choisissez d'abord un langage ci-dessous">
                  Reprendre l'apprentissage
                </Button>
              )}
            </div>
            {!hasStarted ? (
              <p className="text-sm text-[var(--text-secondary)]">
                Aucun cours n'a encore été commencé. Sélectionnez un langage pour démarrer.
              </p>
            ) : null}
          </div>
        </GlassCard>

        <GlassCard className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Progression globale</p>
            <p className="mt-2 text-2xl font-semibold">{completed} leçons</p>
            <p className="text-sm text-[var(--text-secondary)]">
              terminées sur {totalLessons}
            </p>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Exercices réussis : {progress.completedExercises.length}
            </p>
          </div>
          <ProgressRing value={percent} size={96} />
        </GlassCard>
      </motion.section>

      {last ? (
        <GlassCard>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Dernier cours consulté</p>
              <h2 className="mt-1 text-xl font-semibold">
                {last.lang.name} — {last.lesson.title}
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Niveau {last.level.id} · {last.level.title}
              </p>
            </div>
            <Button
              onClick={() =>
                navigate(`/learn/${last.lang.id}/lesson/${last.lesson.id}`)
              }
            >
              Continuer
            </Button>
          </div>
        </GlassCard>
      ) : null}

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Langages</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Sélectionnez un parcours pour commencer.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {languages.map((lang, index) => {
            const total = getAllLessons(lang.id).length;
            const done = progress.completedLessons.filter((id) =>
              id.startsWith(`${lang.id}-`),
            ).length;
            const accent = languageAccentVar(lang.id);
            return (
              <GlassCard
                key={lang.id}
                delay={index * 0.05}
                onClick={() => navigate(`/learn/${lang.id}`)}
                className="group"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center">
                  <img src={`/logos/${lang.id}.png`} alt="" className="h-12 w-12 object-contain" />
                </div>
                <h3 className="text-lg font-semibold">{lang.name}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{lang.tagline}</p>
                <p className="mt-4 text-xs text-[var(--text-secondary)]">
                  {done}/{total} {done === 1 ? "leçon terminée" : "leçons terminées"}
                </p>
                <div className="mt-2">
                  <LessonProgressBar
                    value={done}
                    max={total}
                    accent={accent}
                    label={`Progression ${lang.name}`}
                  />
                </div>
              </GlassCard>
            );
          })}
        </div>
      </section>
    </div>
  );
}
