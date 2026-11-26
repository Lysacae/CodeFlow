import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CodeEditor } from "@/features/editor/CodeEditor";
import { AssistPanel } from "@/features/lesson/AssistPanel";
import { FileWizard } from "@/features/lesson/FileWizard";
import { StepDebugPanel } from "@/features/lesson/StepDebugPanel";
import {
  findLesson,
  getLanguage,
  getNextLesson,
  type Section,
} from "@/shared/lib/content";
import {
  buildAssistResponse,
  type AssistLevel,
  type AssistResponse,
} from "@/shared/lib/assist";
import { classifyError, explainError, formatExplanation } from "@/shared/lib/errorJournal";
import { evaluateChecks } from "@/shared/lib/exerciseChecks";
import { pushJournal, recordReview } from "@/shared/lib/learning";
import {
  executeCode,
  stdoutMatches,
  type ExecuteResult,
} from "@/shared/lib/tauri";
import { playSuccessSound } from "@/shared/lib/successSound";
import { useProgressStore } from "@/shared/store/progressStore";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { CodeHighlight } from "@/shared/ui/CodeHighlight";
import { TipBulb } from "@/shared/ui/TipBulb";

/** Regroupe le texte en vrais paragraphes (2–3 phrases), sans ligne vide entre chaque phrase. */
function proseParagraphs(body: string): string[] {
  const flat = body
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return [];

  const sentences = flat
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý«`])/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [flat];

  const paragraphs: string[] = [];
  const size = sentences.length <= 3 ? sentences.length : 2;
  for (let i = 0; i < sentences.length; i += size) {
    paragraphs.push(sentences.slice(i, i + size).join(" "));
  }
  return paragraphs;
}

function renderInline(text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const inner = part.slice(1, -1);
      const isKeyword =
        /^(if|else|for|while|int|string|String|bool|true|false|print|return|class|public|static|void)$/.test(
          inner,
        );
      return (
        <code
          key={index}
          style={isKeyword ? { color: "#6C8CFF" } : undefined}
        >
          {inner}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function renderProse(body: string) {
  const paragraphs = proseParagraphs(body);
  if (paragraphs.length <= 1) {
    return <>{renderInline(paragraphs[0] || body)}</>;
  }
  return (
    <span className="block space-y-4">
      {paragraphs.map((para, i) => (
        <span key={i} className="block">
          {renderInline(para)}
        </span>
      ))}
    </span>
  );
}

/** Sépare consignes générales et tâche à réaliser (dernier paragraphe). */
function splitExercisePrompt(prompt: string): { guidelines: string; task: string } {
  const parts = prompt
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return { guidelines: "", task: prompt.trim() };
  }
  return {
    guidelines: parts.slice(0, -1).join("\n\n"),
    task: parts[parts.length - 1],
  };
}

export function LessonPage() {
  const { languageId = "", lessonId = "" } = useParams();
  const navigate = useNavigate();
  const found = findLesson(languageId, lessonId);
  const language = getLanguage(languageId);
  const {
    progress,
    markLesson,
    markExercise,
    rememberLesson,
    focusMode,
    setFocusMode,
  } = useProgressStore();

  const exercise = found?.lesson.exercise;
  const [code, setCode] = useState(exercise?.starterCode ?? "");
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [running, setRunning] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [exercisePassed, setExercisePassed] = useState(false);
  const [assistLevel, setAssistLevel] = useState<AssistLevel>(1);
  const [assist, setAssist] = useState<AssistResponse | null>(null);
  const [stepLine, setStepLine] = useState<number | null>(null);
  const [failureNote, setFailureNote] = useState<string | null>(null);
  const [failureId, setFailureId] = useState<string | null>(null);
  const attemptsRef = useRef(0);
  const hintsRef = useRef(0);
  const solutionRef = useRef(false);
  useEffect(() => {
    if (!found || !language) return;
    void rememberLesson(found.lesson.id, language.id);
    setCode(found.lesson.exercise?.starterCode ?? "");
    setResult(null);
    setSuccessMessage(null);
    setExercisePassed(
      Boolean(
        found.lesson.exercise &&
          progress.completedExercises.includes(found.lesson.exercise.id),
      ),
    );
    setAssist(null);
    setAssistLevel(1);
    setStepLine(null);
    setFailureNote(null);
    setFailureId(null);
    attemptsRef.current = 0;
    hintsRef.current = 0;
    solutionRef.current = false;
    const focus = Boolean(found.lesson.exercise);
    setFocusMode(focus);
    if (focus) useProgressionStore.getState().record({ focus: true });
    return () => setFocusMode(false);
  }, [found?.lesson.id, language?.id]);

  const next = useMemo(
    () => (found ? getNextLesson(languageId, found.lesson.id) : null),
    [found, languageId],
  );

  if (!found || !language) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <GlassCard>
          <p>Leçon introuvable.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Retour
          </Button>
        </GlassCard>
      </div>
    );
  }

  const { lesson, level } = found;
  const lessonDone = progress.completedLessons.includes(lesson.id);
  const canContinueExercise = exercisePassed || Boolean(successMessage);
  const showTip =
    Boolean(exercise?.hint) && (level.chapter ?? 1) === 1 && level.id <= 3;

  const completeAndContinue = async () => {
    const target = next
      ? `/learn/${languageId}/lesson/${next.id}`
      : `/learn/${languageId}`;
    navigate(target);
    if (!exercise) {
      useProgressionStore.getState().updateLearning((state) =>
        recordReview(
          state,
          {
            languageId,
            lessonId: lesson.id,
            title: lesson.title,
            chapter: level.chapter ?? 1,
          },
          { passed: true, hints: 0, solution: false, attempts: 1 },
        ),
      );
    }
    if (!lessonDone) {
      void markLesson(lesson.id, language.id, lesson.title);
    }
  };

  const noteFailure = (
    detail: string,
    got: string,
    structureRejected: boolean,
    outputMatched: boolean,
  ) => {
    if (!exercise) return;
    const kind = classifyError({
      stderr: detail,
      expected: exercise.validate.expected,
      got,
      outputMatched,
      structureRejected,
    });
    const text = formatExplanation(explainError(kind, detail));
    const id = `${exercise.id}-${Date.now()}`;
    setFailureNote(text);
    setFailureId(id);
    useProgressionStore.getState().updateLearning((state) => {
      const reviewed = recordReview(
        state,
        {
          languageId,
          lessonId: lesson.id,
          exerciseId: exercise.id,
          title: lesson.title,
          chapter: level.chapter ?? 1,
        },
        {
          passed: false,
          hints: hintsRef.current,
          solution: solutionRef.current,
          attempts: attemptsRef.current,
        },
      );
      return pushJournal(reviewed, {
        id,
        languageId,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        chapter: level.chapter ?? 1,
        exerciseId: exercise.id,
        at: new Date().toISOString(),
        kind,
        message: text,
        expected: exercise.validate.expected,
        got: got.trim(),
        attempts: attemptsRef.current,
        hintsUsed: hintsRef.current,
        solutionConsulted: solutionRef.current,
        understood: false,
        reviewLater: false,
      });
    });
  };

  const onRunExercise = async () => {
    if (!exercise) return;
    attemptsRef.current += 1;
    setRunning(true);
    setSuccessMessage(null);
    setAssist(null);
    setFailureNote(null);
    try {
      const res = await executeCode({ language: languageId, code });
      setResult(res);
      const outputOk = stdoutMatches(res.stdout, exercise.validate.expected);
      const structureMessage = evaluateChecks(code, exercise.validate.checks);
      const seed = {
        languageId,
        lessonId: lesson.id,
        exerciseId: exercise.id,
        title: lesson.title,
        chapter: level.chapter ?? 1,
      };
      const reviewInput = {
        hints: hintsRef.current,
        solution: solutionRef.current,
        attempts: attemptsRef.current,
      };
      if (res.success && outputOk && !structureMessage) {
        setSuccessMessage("Exercice réussi.");
        setExercisePassed(true);
        setFailureNote(null);
        playSuccessSound();
        useProgressionStore.getState().record({ runsOk: 1 });
        useProgressionStore.getState().updateLearning((state) =>
          recordReview(state, seed, { ...reviewInput, passed: true }),
        );
        await markExercise(exercise.id, language.id, lesson.title);
        if (!lessonDone) {
          await markLesson(lesson.id, language.id, lesson.title);
        }
      } else if (res.success && structureMessage) {
        useProgressionStore.getState().record({ runsFail: 1 });
        noteFailure(structureMessage, res.stdout, true, false);
        setSuccessMessage(null);
        setResult({
          ...res,
          success: false,
          stderr: `${structureMessage}\n\nLa sortie seule ne suffit pas : le programme doit utiliser ce que la leçon enseigne.\n\n[log] succès runtime=oui · structure=non · match=${outputOk ? "oui" : "non"} · exit=${res.exitCode ?? "?"}`,
        });
      } else if (res.success) {
        useProgressionStore.getState().record({ runsFail: 1 });
        noteFailure(
          `Sortie incorrecte.\n\nTexte obtenu : « ${res.stdout.trim() || "(vide)"} »\nTexte attendu : « ${exercise.validate.expected} »`,
          res.stdout,
          false,
          false,
        );
        setSuccessMessage(null);
        setResult({
          ...res,
          success: false,
          stderr: `Sortie incorrecte.\n\nTexte obtenu : « ${res.stdout.trim() || "(vide)"} »\nTexte attendu : « ${exercise.validate.expected} »\n\nComparez chaque caractère : majuscules, espaces, accents et ponctuation doivent être identiques.\n\n[log] succès runtime=oui · match=non · exit=${res.exitCode ?? "?"}`,
        });
      } else {
        useProgressionStore.getState().record({ runsFail: 1 });
        noteFailure(res.stderr || res.compileOutput || "Exécution interrompue.", res.stdout, false, false);
        const details = [
          res.stderr?.trim(),
          res.compileOutput?.trim(),
          !res.stdout.trim() && !res.stderr?.trim()
            ? "Aucune sortie produite."
            : "",
          `[log] succès=non · timeout=${res.timedOut ? "oui" : "non"} · exit=${res.exitCode ?? "?"} · stdout=${res.stdout.trim() ? "oui" : "vide"}`,
        ]
          .filter(Boolean)
          .join("\n\n");
        setResult({
          ...res,
          stderr: details || res.stderr,
        });
      }
    } catch (e) {
      setResult({
        success: false,
        stdout: "",
        stderr: `[log] exception\n${e instanceof Error ? e.message : String(e)}`,
        exitCode: null,
        timedOut: false,
        compileOutput: null,
      });
    } finally {
      setRunning(false);
    }
  };

  const onAskAssist = () => {
    if (!exercise) return;
    const response = buildAssistResponse({
      language: languageId,
      stderr: result?.stderr || result?.compileOutput || "",
      code,
      expected: exercise.validate.expected,
      hint: exercise.hint,
      level: assistLevel,
      allowLiteralFix: !exercise.validate.checks,
    });
    setAssist(response);
    if (assistLevel >= 3) solutionRef.current = true;
    else hintsRef.current += 1;
    useProgressionStore.getState().record({ assist: true });
    setAssistLevel((prev) => (prev < 3 ? ((prev + 1) as AssistLevel) : 3));
  };

  const isTheoryOnly = lesson.kind !== "file-wizard" && !exercise;

  const renderSections = (sections: Section[]) => (
    <GlassCard className="space-y-4 text-left">
      {sections.map((section, index) => {
        if (section.type === "prose" && section.body) {
          return (
            <div key={index} className="space-y-2">
              {section.heading ? (
                <p className="text-sm font-semibold text-[var(--text)]">{section.heading}</p>
              ) : null}
              <p className="prose-lesson text-left">
                {renderProse(section.body)}
              </p>
            </div>
          );
        }
        if (section.type === "code" && section.code) {
          return <CodeHighlight key={index} code={section.code} />;
        }
        return null;
      })}
    </GlassCard>
  );

  const theoryBlocks = renderSections(lesson.sections);

  return (
    <div className="w-full min-w-0 space-y-6">
      {!focusMode ? (
        <div className="text-left">
          <Link
            to={`/learn/${languageId}`}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text)]"
          >
            ← Parcours {language.name}
          </Link>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Chapitre {level.chapter ?? 1} · Niveau {level.id} · {level.title}
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{lesson.title}</h1>
        </div>
      ) : (
        <div className="text-left">
          <p className="text-sm text-[var(--text-secondary)]">Mode Focus</p>
          <h1 className="text-2xl font-semibold">{lesson.title}</h1>
        </div>
      )}

      {isTheoryOnly ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full min-w-0 space-y-4"
        >
          {theoryBlocks}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => void completeAndContinue()}>
              {next ? "Continuer" : "Terminer le niveau"}
            </Button>
          </div>
        </motion.div>
      ) : null}

      {lesson.kind === "file-wizard" && lesson.fileWizard ? (
        <div className="space-y-4">
          <div className="w-full min-w-0">{theoryBlocks}</div>
          <FileWizard
            languageId={languageId}
            defaultName={lesson.fileWizard.defaultName}
            extension={lesson.fileWizard.extension}
            starterCode={lesson.fileWizard.starterCode}
            notes={lesson.fileWizard.notes}
            requireClassNameMatch={lesson.fileWizard.requireClassNameMatch}
            onSaved={async () => {
              if (!lessonDone) {
                await markLesson(lesson.id, language.id, lesson.title);
              }
            }}
            onContinue={completeAndContinue}
          />
        </div>
      ) : null}

      {exercise ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {theoryBlocks}
            {(() => {
              const { guidelines, task } = splitExercisePrompt(exercise.prompt);
              return (
                <aside className="rounded-[22px] border border-[rgba(108,140,255,0.35)] bg-[rgba(108,140,255,0.08)] px-5 py-4 shadow-[0_10px_40px_rgba(0,0,0,0.18)]">
                  {guidelines ? (
                    <div className="mb-4 text-left">
                      <p className="text-sm font-bold underline underline-offset-4">
                        Explication
                      </p>
                      <p className="prose-lesson mt-2 text-[var(--text-secondary)]">
                        {renderProse(guidelines)}
                      </p>
                    </div>
                  ) : null}
                  <div className="text-left">
                    <p className="text-sm font-bold underline underline-offset-4">
                      Exercice
                    </p>
                    <p className="prose-lesson mt-2 font-semibold underline decoration-[var(--accent)] underline-offset-4">
                      {renderProse(task)}
                    </p>
                    <p className="mt-3 text-sm text-[var(--text-secondary)]">
                      Sortie attendue :{" "}
                      <code className="font-semibold text-[var(--text)]">
                        {exercise.validate.expected.replace(/\n/g, " ↵ ")}
                      </code>
                    </p>
                  </div>
                </aside>
              );
            })()}
          </motion.div>

          <div className="space-y-4">
            <CodeEditor
              language={languageId}
              monacoLanguage={language.monaco}
              value={code}
              onChange={setCode}
              onRun={onRunExercise}
              onReset={() => {
                setCode(exercise.starterCode);
                setResult(null);
                setSuccessMessage(null);
                setAssist(null);
                setAssistLevel(1);
              }}
              running={running}
              result={result}
              successMessage={successMessage}
              highlightLine={stepLine}
              extraActions={
                <Button variant="ghost" onClick={() => setFocusMode(!focusMode)}>
                  {focusMode ? "Quitter Focus" : "Mode Focus"}
                </Button>
              }
              footerActions={
                canContinueExercise ? (
                  <Button onClick={completeAndContinue}>
                    {next ? "Leçon suivante" : "Retour au parcours"}
                  </Button>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">
                    Exécutez le programme correctement pour continuer.
                  </p>
                )
              }
            />
            <StepDebugPanel language={languageId} code={code} onHighlight={setStepLine} />
            {failureNote ? (
              <GlassCard className="space-y-3 text-left">
                <h2 className="text-lg font-semibold">Comprendre l'erreur</h2>
                <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{failureNote}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (!failureId) return;
                      useProgressionStore.getState().updateLearning((state) => {
                        const next = {
                          ...state,
                          journal: state.journal.map((entry) =>
                            entry.id === failureId ? { ...entry, understood: true, reviewLater: false } : entry,
                          ),
                        };
                        return next;
                      });
                      setFailureNote(null);
                    }}
                  >
                    J'ai compris
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/revision")}
                  >
                    Ouvrir la révision
                  </Button>
                </div>
              </GlassCard>
            ) : null}
          </div>
        </div>
      ) : null}

      {showTip && exercise?.hint ? <TipBulb tip={exercise.hint} /> : null}

      {exercise ? (
        <AssistPanel
          response={assist}
          onAsk={onAskAssist}
          disabled={!result || Boolean(successMessage)}
        />
      ) : null}
    </div>
  );
}
