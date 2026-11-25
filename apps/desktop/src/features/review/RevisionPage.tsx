import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { findLesson, getLanguage } from "@/shared/lib/content";
import { dueNotions, revisitNotions } from "@/shared/lib/learning";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";

export function RevisionPage() {
  const navigate = useNavigate();
  const learning = useProgressionStore((s) => s.doc.learning);
  const due = useMemo(() => dueNotions(learning), [learning]);
  const revisit = useMemo(
    () => revisitNotions(learning).filter((card) => !due.some((item) => item.id === card.id)),
    [learning, due],
  );
  const studied = Object.values(learning.notions);
  const mastered = studied.filter((card) => card.mastery >= 70 && card.successes >= 3);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="label kicker">Mémoire orbitale</div>
          <h1>Révision</h1>
          <p className="sub">
          Les notions reviennent selon les réussites, les échecs, les indices et les solutions consultées.
          Une seule réussite ne marque pas la notion comme maîtrisée.
          </p>
        </div>
      </div>

      <div className="ds-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="card rev-stat">
          <div><div className="label">À revoir</div><div className="stat-num" style={{ marginTop: 14 }}>{due.length}</div></div>
        </div>
        <div className="card rev-stat">
          <div><div className="label">Maîtrise fragile</div><div className="stat-num" style={{ marginTop: 14 }}>{revisit.length}</div></div>
        </div>
        <div className="card rev-stat">
          <div><div className="label">Maîtrisées</div><div className="stat-num" style={{ marginTop: 14 }}>{mastered.length}</div></div>
        </div>
      </div>

      <Section
        title="Révisions dues"
        empty="Aucune révision n'est due. Terminez un exercice pour alimenter le planning."
        cards={due}
        onOpen={(languageId, lessonId) => navigate(`/learn/${languageId}/lesson/${lessonId}`)}
      />
      <Section
        title="Notions à retravailler"
        empty="Aucune notion fragile pour le moment."
        cards={revisit}
        onOpen={(languageId, lessonId) => navigate(`/learn/${languageId}/lesson/${lessonId}`)}
      />
      <Section
        title="Déjà solides"
        empty="Trois réussites propres, sans solution consultée, font monter une notion ici."
        cards={mastered}
        onOpen={(languageId, lessonId) => navigate(`/learn/${languageId}/lesson/${lessonId}`)}
      />
    </div>
  );
}

function Section({
  title,
  empty,
  cards,
  onOpen,
}: {
  title: string;
  empty: string;
  cards: ReturnType<typeof dueNotions>;
  onOpen: (languageId: string, lessonId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {cards.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{empty}</p>
      ) : (
        cards.map((card) => {
          const lang = getLanguage(card.languageId);
          const lesson = findLesson(card.languageId, card.lessonId);
          return (
            <GlassCard key={card.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{card.title}</p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {lang?.name ?? card.languageId} · chapitre {card.chapter}
                  {lesson ? ` · ${lesson.level.title}` : ""}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Maîtrise {card.mastery} % · {card.successes} réussite{card.successes > 1 ? "s" : ""} · {card.failures} échec{card.failures > 1 ? "s" : ""}
                  {card.hintsUsed ? ` · ${card.hintsUsed} indice${card.hintsUsed > 1 ? "s" : ""}` : ""}
                  {card.solutionsSeen ? ` · solution vue ${card.solutionsSeen} fois` : ""}
                </p>
              </div>
              <Button onClick={() => onOpen(card.languageId, card.lessonId)}>
                {card.exerciseId ? "Refaire l'exercice" : "Revoir la leçon"}
              </Button>
            </GlassCard>
          );
        })
      )}
    </section>
  );
}
