import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import {
  getLanguage,
  getQuiz,
  getTrack,
  isChapterComplete,
} from "@/shared/lib/content";
import { formatDuration, normalizeQa, qaAccuracy } from "@/shared/lib/quiz";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { isDevTesting } from "@/shared/lib/devAccess";
import { Button } from "@/shared/ui/Button";
import { OrbitRing } from "@/shared/ui/OrbitRing";

const LANG_MARK: Record<string, { cls: string; text: string }> = {
  python: { cls: "python", text: "Py" },
  csharp: { cls: "csharp", text: "C#" },
  cpp: { cls: "cpp", text: "C++" },
  java: { cls: "java", text: "Jv" },
};

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

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
      <div className="page narrow">
        <section className="card">
          <p>Parcours introuvable.</p>
          <Button className="mt-4" onClick={() => navigate("/")}>Retour</Button>
        </section>
      </div>
    );
  }

  const chapter1Done = isChapterComplete(languageId, 1, progress.completedLessons);

  const isLevelUnlocked = (levelIndex: number) => {
    const level = track.levels[levelIndex];
    const chapter = level.chapter ?? 1;
    if (chapter > 1 && !chapter1Done) return false;
    if (levelIndex === 0) return true;
    if (level.lessons.some((l) => progress.completedLessons.includes(l.id))) return true;
    const prev = track.levels[levelIndex - 1];
    if ((prev.chapter ?? 1) < chapter) return chapter1Done;
    return prev.lessons.every((lesson) => progress.completedLessons.includes(lesson.id));
  };

  const chapters = Array.from(new Set(track.levels.map((l) => l.chapter ?? 1))).sort((a, b) => a - b);
  const quiz = getQuiz(languageId);
  const qaState = normalizeQa(progress.qa?.[languageId], quiz?.questions.length ?? 0);
  const quizDone = Boolean(quiz) && qaState.correctIds.length >= (quiz?.questions.length ?? 1);
  const allLessons = track.levels.flatMap((level) => level.lessons);
  const langDone = allLessons.filter((lesson) => progress.completedLessons.includes(lesson.id)).length;
  const pathRatio = allLessons.length ? (langDone / allLessons.length) * 100 : 0;
  const mark = LANG_MARK[language.id] ?? { cls: "", text: language.name.slice(0, 2) };
  const quizRatio = quiz?.questions.length ? (qaState.correctIds.length / quiz.questions.length) * 100 : 0;

  return (
    <div className="page narrow">
      <Link className="back" to="/">
        <Icon d="M19 12H5M12 19l-7-7 7-7" size={14} />
        Tableau de bord
      </Link>
      <div className="path-head">
        <div className="row gap-5">
          <span className={`lang-ico lg ${mark.cls}`}>{mark.text}</span>
          <div>
            <h1>{language.name}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{language.tagline}</p>
          </div>
        </div>
        <div className="row gap-2">
          <Button variant="secondary" onClick={() => openTutorial(languageId)}>
            <Icon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
            Tutoriel
          </Button>
          <span className="btn btn-secondary">
            <Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" />
            Extension {language.extension}
          </span>
        </div>
      </div>
      <div className="path-progress">
        <span className="label">Progression du parcours</span>
        <div className={`bar${pathRatio === 0 ? " zero" : ""}`} style={{ flex: 1 }}>
          <i style={{ width: `${pathRatio}%` }} />
        </div>
        <span className="num" style={{ fontSize: 13 }}>
          {langDone}/{allLessons.length} <span className="faint">leçons</span>
        </span>
      </div>

      {quiz ? (
        <section className="card qa-card">
          <div className="qa-ring">
            <OrbitRing
              value={quizRatio}
              size={64}
              stroke={4}
              center={<span className="num" style={{ fontSize: 13 }}>{qaState.correctIds.length}</span>}
            />
          </div>
          <div style={{ flex: 1 }}>
            <h3>Questions / Réponses</h3>
            <div className="faint" style={{ fontSize: 13, marginTop: 2 }}>
              <span className="num">{qaState.correctIds.length}/{quiz.questions.length}</span> maîtrisées
              {qaState.attempts > 0 ? ` · ${qaAccuracy(qaState)} % de bonnes réponses` : ""}
              {qaState.completionMs != null
                ? ` · terminé en ${formatDuration(qaState.completionMs)}`
                : qaState.timeSpentMs > 0
                  ? ` · ${formatDuration(qaState.timeSpentMs)}`
                  : " · 25 secondes par question"}
            </div>
          </div>
          <Button onClick={() => navigate(`/learn/${languageId}/quiz`)}>
            {quizDone ? "Voir le résultat" : qaState.attempts > 0 ? "Continuer" : "Commencer"} <Chevron />
          </Button>
        </section>
      ) : null}

      <div className="stack gap-4" style={{ marginTop: 16 }}>
        {chapters.map((chapter) => {
          const chapterLevels = track.levels.filter((l) => (l.chapter ?? 1) === chapter);
          const lockedChapter = !dev && chapter > 1 && !chapter1Done;
          const preferred =
            progress.lastLanguage === languageId && progress.lastLessonId
              ? (track.levels.find((level) => level.lessons.some((lesson) => lesson.id === progress.lastLessonId))?.chapter ?? chapters[0] ?? 1)
              : (chapters[0] ?? 1);
          const opened = openChapters[languageId] ?? [preferred];
          const isOpen = opened.includes(chapter);
          const lessonTotal = chapterLevels.reduce((sum, level) => sum + level.lessons.length, 0);
          const lessonDone = chapterLevels.reduce(
            (sum, level) => sum + level.lessons.filter((lesson) => progress.completedLessons.includes(lesson.id)).length,
            0,
          );
          const ratio = lessonTotal ? (lessonDone / lessonTotal) * 100 : 0;
          const toggle = () => {
            setOpenChapters((current) => {
              const list = current[languageId] ?? [preferred];
              const next = list.includes(chapter) ? list.filter((item) => item !== chapter) : [...list, chapter];
              return { ...current, [languageId]: next };
            });
          };
          let cursor = 0;

          return (
            <section key={chapter} className={clsx("card chap", isOpen && "open")}>
              <button type="button" className="chap-head" onClick={toggle} aria-expanded={isOpen} style={{ width: "100%", background: "transparent", border: 0, color: "inherit", font: "inherit", cursor: "pointer", textAlign: "left" }}>
                <div className="chap-num num">{chapter}</div>
                <div style={{ flex: 1 }}>
                  <h3>Chapitre {chapter}{lockedChapter ? " · verrouillé" : ""}</h3>
                  <div className="faint" style={{ fontSize: 13 }}>
                    <span className="num">{lessonDone}/{lessonTotal}</span> leçons
                    {lockedChapter ? " · terminez le chapitre 1 pour débloquer" : ""}
                  </div>
                </div>
                <div style={{ width: 260 }} className={`bar thin${ratio === 0 ? " zero" : ""}`}>
                  <i style={{ width: `${ratio}%` }} />
                </div>
                <span className="chev">
                  <svg className="icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </button>
              {isOpen ? (
                <div className="lessons">
                  {chapterLevels.map((level) => {
                    const levelIndex = track.levels.findIndex((l) => l.id === level.id);
                    const unlocked = dev || (!lockedChapter && isLevelUnlocked(levelIndex));
                    return (
                      <div key={level.id}>
                        <div className="faint" style={{ fontSize: 12.5, padding: "8px 8px 2px 44px" }}>
                          Niveau {level.id} · {level.title}{!unlocked ? " · verrouillé" : ""}
                        </div>
                        {level.lessons.map((lesson, lessonIndex) => {
                          cursor += 1;
                          const index = cursor;
                          const done = progress.completedLessons.includes(lesson.id);
                          const previousDone = lessonIndex === 0 || progress.completedLessons.includes(level.lessons[lessonIndex - 1].id);
                          const canOpen = dev || (unlocked && (done || previousDone || lessonIndex === 0));
                          const current = canOpen && !done && previousDone;
                          return (
                            <button
                              key={lesson.id}
                              type="button"
                              disabled={!canOpen}
                              onClick={() => navigate(`/learn/${languageId}/lesson/${lesson.id}`)}
                              className={clsx("lesson", done && "done", current && "cur", !done && !current && "todo")}
                              style={{ width: "100%", background: current ? undefined : "transparent", border: 0, color: "inherit", font: "inherit", cursor: canOpen ? "pointer" : "not-allowed", textAlign: "left" }}
                            >
                              <span className="lnode" />
                              <span className="num faint" style={{ width: 26, fontSize: 12 }}>{String(index).padStart(2, "0")}</span>
                              <span style={{ flex: 1 }}>{lesson.title}</span>
                              {done ? <span className="badge success plain">Validée</span> : current ? <span className="badge accent">En cours</span> : !canOpen ? <span className="badge plain">Verrouillée</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Chevron() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
