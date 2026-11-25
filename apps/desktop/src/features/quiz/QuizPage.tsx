import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getLanguage, getQuiz } from "@/shared/lib/content";
import {
  applyQaAnswer,
  formatDuration,
  normalizeQa,
  pickNextQuestionId,
  qaAccuracy,
} from "@/shared/lib/quiz";
import type { QaLanguageProgress } from "@/shared/lib/tauri";
import { useProgressStore } from "@/shared/store/progressStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";

export function QuizPage() {
  const { languageId = "" } = useParams();
  const navigate = useNavigate();
  const language = getLanguage(languageId);
  const quiz = getQuiz(languageId);
  const storedQa = useProgressStore((s) => s.progress.qa?.[languageId]);
  const recordQa = useProgressStore((s) => s.recordQa);

  const poolSize = quiz?.questions.length ?? 0;
  const limitMs = (quiz?.secondsPerQuestion ?? 25) * 1000;
  const [qa, setQa] = useState<QaLanguageProgress>(() => normalizeQa(storedQa, poolSize));
  const [questionId, setQuestionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"ask" | "feedback" | "pause" | "done">("ask");
  const [remainingMs, setRemainingMs] = useState(limitMs);
  const [picked, setPicked] = useState<number | null>(null);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [holdSame, setHoldSame] = useState(false);
  const [nextId, setNextId] = useState<string | null>(null);
  const startedAt = useRef(0);
  const locked = useRef(false);
  const qaRef = useRef(qa);
  qaRef.current = qa;

  useEffect(() => {
    if (!quiz) return;
    const initial = normalizeQa(storedQa, quiz.questions.length);
    setQa(initial);
    if (initial.completionMs != null || initial.correctIds.length >= quiz.questions.length) {
      setPhase("done");
      setQuestionId(null);
      return;
    }
    const ids = quiz.questions.map((question) => question.id);
    setQuestionId(pickNextQuestionId(ids, initial.correctIds, initial.failedIds, null));
    setPhase("ask");
    // Reprise uniquement au changement de langage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageId]);

  useEffect(() => {
    if (phase !== "ask" || !questionId) return;
    locked.current = false;
    startedAt.current = Date.now();
    setRemainingMs(limitMs);
    setPicked(null);
    const timer = window.setInterval(() => {
      const left = limitMs - (Date.now() - startedAt.current);
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(timer);
        answer(-1);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [phase, questionId, limitMs]);

  if (!language || !quiz) {
    return (
      <GlassCard>
        <p>Questionnaire introuvable.</p>
        <Button className="mt-4" onClick={() => navigate("/")}>
          Retour
        </Button>
      </GlassCard>
    );
  }

  const question = quiz.questions.find((item) => item.id === questionId) ?? null;
  const mastered = qa.correctIds.length;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const ratio = limitMs ? Math.max(0, remainingMs / limitMs) : 0;

  function answer(choice: number) {
    if (locked.current || phase !== "ask" || !quiz || !questionId) return;
    const current = quiz.questions.find((item) => item.id === questionId);
    if (!current) return;
    locked.current = true;
    const correct = choice === current.answer;
    const elapsed = Math.min(limitMs, Math.max(0, Date.now() - startedAt.current));
    const nextQa = applyQaAnswer(qaRef.current, questionId, correct, elapsed, quiz.questions.length);
    setQa(nextQa);
    setLastCorrect(correct);
    setPicked(choice);
    void recordQa(languageId, nextQa);
    if (nextQa.correctIds.length >= quiz.questions.length) {
      setPhase("done");
      return;
    }
    const ids = quiz.questions.map((item) => item.id);
    const nextId = pickNextQuestionId(
      ids,
      nextQa.correctIds,
      nextQa.failedIds,
      correct ? null : questionId,
    );
    const same = !correct && nextId === questionId;
    setHoldSame(same);
    setNextId(same ? questionId : nextId);
    setPhase("feedback");
  }

  function continueAfterFeedback() {
    if (holdSame) {
      setPhase("pause");
      return;
    }
    setQuestionId(nextId);
    setPhase("ask");
  }

  return (
    <div className="page narrow">
      <div>
        <Link
          to={`/learn/${languageId}`}
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)]"
        >
          ← {language.name}
        </Link>
        <h1 className="mt-3 text-3xl font-semibold">Questions / Réponses</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          {mastered}/{quiz.questions.length} maîtrisées
          {qa.attempts > 0 ? ` · ${qaAccuracy(qa)} % de bonnes réponses` : ""}
          {qa.timeSpentMs > 0 ? ` · ${formatDuration(qa.timeSpentMs)}` : ""}
        </p>
      </div>

      {phase === "done" ? (
        <GlassCard className="space-y-3">
          <h2 className="text-xl font-semibold">Série terminée</h2>
          <p className="text-[var(--text-secondary)]">
            Vous maîtrisez les {quiz.questions.length} questions de {language.name}.
          </p>
          <p>
            Bonnes réponses : {qa.correctAttempts}/{qa.attempts} ({qaAccuracy(qa)} %)
          </p>
          <p>Temps pour terminer : {formatDuration(qa.completionMs ?? qa.timeSpentMs)}</p>
          <Button variant="secondary" onClick={() => navigate(`/learn/${languageId}`)}>
            Retour au parcours
          </Button>
        </GlassCard>
      ) : null}

      {phase === "pause" ? (
        <GlassCard className="space-y-3">
          <h2 className="text-xl font-semibold">Question suivante</h2>
          <p className="text-[var(--text-secondary)]">
            Il ne reste que la question manquée. Elle revient maintenant, pas dans la foulée de
            l'erreur.
          </p>
          <Button
            onClick={() => {
              setHoldSame(false);
              setPhase("ask");
            }}
          >
            Afficher la question
          </Button>
        </GlassCard>
      ) : null}

      {phase === "ask" && question ? (
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
            <span>Temps restant</span>
            <span className="tabular-nums font-medium text-[var(--text)]">{secondsLeft} s</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-strong)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-secondary))]"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <p className="text-lg font-medium">{question.prompt}</p>
          <div className="grid gap-2">
            {question.choices.map((choice, index) => (
              <button
                key={`${question.id}-${index}`}
                type="button"
                onClick={() => answer(index)}
                className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:bg-[var(--surface-strong)]"
              >
                {choice}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Une erreur envoie une autre question. La question manquée revient plus tard.
          </p>
        </GlassCard>
      ) : null}

      {phase === "feedback" && question ? (
        <GlassCard className="space-y-3">
          <h2 className="text-xl font-semibold">
            {lastCorrect ? "Bonne réponse" : picked === -1 ? "Temps écoulé" : "Réponse incorrecte"}
          </h2>
          <p className="text-[var(--text-secondary)]">{question.explanation}</p>
          {!lastCorrect ? (
            <p className="text-sm">
              La bonne réponse était : {question.choices[question.answer]}
            </p>
          ) : null}
          {!lastCorrect ? (
            <p className="text-sm text-[var(--text-secondary)]">
              {holdSame
                ? "Vous ne pouvez pas la recommencer tout de suite."
                : "Cette question reviendra plus tard. Une autre est tirée au sort."}
            </p>
          ) : null}
          <Button onClick={continueAfterFeedback}>Question suivante</Button>
        </GlassCard>
      ) : null}
    </div>
  );
}
