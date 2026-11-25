import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  countLessons,
  findLesson,
  getAllLessons,
  getLanguage,
  languages,
} from "@/shared/lib/content";
import { useProgressStore } from "@/shared/store/progressStore";
import { Button } from "@/shared/ui/Button";
import { OrbitRing } from "@/shared/ui/OrbitRing";

const MARK: Record<string, { cls: string; text: string }> = {
  python: { cls: "python", text: "Py" },
  csharp: { cls: "csharp", text: "C#" },
  cpp: { cls: "cpp", text: "C++" },
  java: { cls: "java", text: "Jv" },
};

function Chevron() {
  return (
    <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

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
    <div className="page wide">
      <div className="dash-top">
        <section className="card hero">
          <svg className="hero-orbit" viewBox="0 0 420 300" aria-hidden="true">
            <defs>
              <linearGradient id="ho" x1="0" x2="1">
                <stop offset="0" stopColor="var(--indigo)" stopOpacity="0" />
                <stop offset="0.5" stopColor="var(--violet)" stopOpacity="0.7" />
                <stop offset="1" stopColor="var(--cyan)" stopOpacity="0.9" />
              </linearGradient>
              <radialGradient id="planet" cx="0.35" cy="0.3">
                <stop offset="0" stopColor="#9aa6ff" />
                <stop offset="0.55" stopColor="#4a52c9" />
                <stop offset="1" stopColor="#151840" />
              </radialGradient>
            </defs>
            <ellipse cx="250" cy="150" rx="190" ry="62" transform="rotate(-16 250 150)" fill="none" stroke="var(--line-2)" />
            <ellipse cx="250" cy="150" rx="190" ry="62" transform="rotate(-16 250 150)" fill="none" stroke="url(#ho)" strokeWidth="1.5" strokeDasharray="300 900" />
            <ellipse cx="250" cy="150" rx="140" ry="44" transform="rotate(-16 250 150)" fill="none" stroke="var(--line-2)" strokeDasharray="2 5" />
            <circle cx="250" cy="150" r="46" fill="url(#planet)" />
            <circle cx="250" cy="150" r="46" fill="none" stroke="rgba(255,255,255,.18)" />
            <circle cx="250" cy="150" r="96" fill="none" stroke="var(--line)" />
            <circle cx="419" cy="98" r="4" fill="var(--cyan)" />
            <circle cx="118" cy="190" r="2.5" fill="var(--violet)" />
          </svg>
          <div className="hero-inner">
            <div className="label kicker-l">Tableau de bord</div>
            <h1 className="hero-title">
              Commencez votre
              <br />
              apprentissage.
            </h1>
            <p className="muted" style={{ maxWidth: 470 }}>
              Choisissez un langage ci-dessous, suivez un parcours progressif, exécutez votre code et créez votre premier fichier.
            </p>
            <div className="row gap-4" style={{ marginTop: 28 }}>
              <Button
                size="lg"
                disabled={!hasStarted}
                title={hasStarted ? undefined : "Choisissez d'abord un langage ci-dessous"}
                onClick={() => {
                  if (last) navigate(`/learn/${last.lang.id}/lesson/${last.lesson.id}`);
                  else if (hasStarted) navigate("/learn/python");
                }}
              >
                Reprendre l'apprentissage <Chevron />
              </Button>
              <span className="faint" style={{ fontSize: 13 }}>
                {last ? (
                  <>
                    Dernier parcours : <span style={{ color: "var(--text-2)" }}>{last.lang.name} · Chapitre {last.level.chapter ?? 1}</span>
                  </>
                ) : (
                  "Aucun cours n'a encore été commencé."
                )}
              </span>
            </div>
          </div>
        </section>

        <section className="card progress-card">
          <div className="label">Progression globale</div>
          <div className="row gap-6" style={{ marginTop: 18 }}>
            <OrbitRing value={percent} size={150} label="global" ticks />
            <div className="stack gap-2">
              <div>
                <span className="stat-num">{completed}</span> <span className="muted">leçons</span>
              </div>
              <div className="faint" style={{ fontSize: 13 }}>
                terminées sur <span className="num">{totalLessons}</span>
              </div>
              <div className="divider" style={{ margin: "10px 0" }} />
              <div className="muted" style={{ fontSize: 13 }}>
                Exercices réussis : <span className="num" style={{ color: "var(--text)" }}>{progress.completedExercises.length}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="section-title">
        <h2>Langages</h2>
        <span className="faint" style={{ fontSize: 13.5 }}>Sélectionnez un parcours pour commencer.</span>
      </div>
      <div className="ds-grid lang-grid">
        {languages.map((lang) => {
          const total = getAllLessons(lang.id).length;
          const done = progress.completedLessons.filter((id) => id.startsWith(`${lang.id}-`)).length;
          const ratio = total ? (done / total) * 100 : 0;
          const mark = MARK[lang.id] ?? { cls: "", text: lang.name.slice(0, 2) };
          return (
            <button
              key={lang.id}
              type="button"
              className="card hoverable lang-card"
              onClick={() => navigate(`/learn/${lang.id}`)}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className={`lang-ico ${mark.cls}`}>{mark.text}</span>
                <span className="num faint" style={{ fontSize: 12 }}>{Math.round(ratio)}%</span>
              </div>
              <h3>{lang.name}</h3>
              <p className="muted">{lang.tagline}</p>
              <div className="lc-foot">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="faint" style={{ fontSize: 12.5 }}>
                    <span className="num" style={{ color: "var(--text-2)" }}>{done}/{total}</span> leçons terminées
                  </span>
                  <Chevron />
                </div>
                <div className={`bar thin${ratio === 0 ? " zero" : ""}`}>
                  <i style={{ width: `${ratio}%` }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
