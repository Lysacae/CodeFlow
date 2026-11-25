import { useEffect, useMemo, useRef, useState } from "react";
import { traceCode, type TraceEvent, type TraceResult } from "@/shared/lib/tauri";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { Spinner } from "@/shared/ui/Spinner";

type Props = {
  language: string;
  code: string;
  onHighlight: (line: number | null) => void;
};

export function StepDebugPanel({ language, code, onHighlight }: Props) {
  const [tracing, setTracing] = useState(false);
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef(code);
  codeRef.current = code;
  const highlightRef = useRef(onHighlight);
  highlightRef.current = onHighlight;

  useEffect(() => {
    setTrace(null);
    setIndex(0);
    setPlaying(false);
    setError(null);
  }, [code, language]);

  const events = trace?.events ?? [];
  const current: TraceEvent | null = events[index] ?? null;

  useEffect(() => {
    highlightRef.current(current?.line ?? null);
  }, [current?.line]);

  useEffect(() => {
    if (!playing) return;
    if (index >= events.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 700);
    return () => window.clearTimeout(timer);
  }, [playing, index, events.length]);

  const changes = useMemo(() => {
    if (!current) return [];
    const previous = events[index - 1];
    const before = new Map((previous?.locals ?? []).map((item) => [item.name, item.value]));
    return current.locals.filter((item) => before.get(item.name) !== item.value);
  }, [current, events, index]);

  const capture = async () => {
    setTracing(true);
    setError(null);
    setPlaying(false);
    try {
      const result = await traceCode({ language, code: codeRef.current });
      setTrace(result);
      setIndex(0);
      if (result.events.length === 0 && result.limitation) {
        setError(result.limitation);
      }
    } catch (e) {
      setTrace(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTracing(false);
    }
  };

  const python = language === "python";

  return (
    <GlassCard className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Pas à pas</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {python
            ? "Python est exécuté avec un vrai traceur. Vous avancez ensuite dans les lignes, variables et appels réellement enregistrés. Le programme n'est pas mis en pause au milieu : la trace est celle de l'exécution complète."
            : "Pour ce langage, CodeFlow tente d'enregistrer les lignes réellement exécutées. Les valeurs des variables ne sont pas lues. Si l'instrumentation est impossible, un message l'indique."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void capture()} disabled={tracing}>
          {tracing ? <Spinner size="sm" /> : null}
          {trace ? "Relancer" : "Démarrer"}
        </Button>
        <Button variant="secondary" disabled={!current || index >= events.length - 1} onClick={() => { setPlaying(false); setIndex((value) => value + 1); }}>
          Pas
        </Button>
        <Button variant="secondary" disabled={!trace || events.length === 0 || playing} onClick={() => setPlaying(true)}>
          {index > 0 && index < events.length - 1 ? "Reprendre" : "Lecture"}
        </Button>
        <Button variant="ghost" disabled={!playing} onClick={() => setPlaying(false)}>
          Pause
        </Button>
        <Button variant="ghost" disabled={!trace} onClick={() => { setPlaying(false); setIndex(0); }}>
          Recommencer
        </Button>
        <Button
          variant="ghost"
          disabled={!trace}
          onClick={() => {
            setPlaying(false);
            setTrace(null);
            setIndex(0);
            setError(null);
            onHighlight(null);
          }}
        >
          Stop
        </Button>
      </div>
      {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
      {trace && !error && trace.limitation && language !== "python" ? (
        <p className="text-sm text-[var(--text-secondary)]">{trace.limitation}</p>
      ) : null}
      {current ? (
        <div className="space-y-2 text-sm">
          <p>
            Ligne {current.line}
            {current.function ? ` · ${current.function}` : ""} · {eventLabel(current.event)} · {index + 1}/{events.length}
          </p>
          {current.returned ? <p>Retour : <code>{current.returned}</code></p> : null}
          {current.locals.length > 0 ? (
            <ul className="space-y-1">
              {current.locals.map((item) => {
                const changed = changes.some((change) => change.name === item.name);
                return (
                  <li key={item.name} className={changed ? "text-[var(--text)]" : "text-[var(--text-secondary)]"}>
                    <code>{item.name}</code> : {item.typeName} = {item.value}
                    {changed ? " · changé" : ""}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-[var(--text-secondary)]">
              {python ? "Aucune variable locale sur cette étape." : "Variables non disponibles pour ce langage."}
            </p>
          )}
          {(trace?.stdout.trim() ?? "") !== "" ? (
            <p className="text-[var(--text-secondary)]">Sortie finale : {trace?.stdout.trim()}</p>
          ) : null}
        </div>
      ) : trace && events.length === 0 ? null : (
        <p className="text-sm text-[var(--text-secondary)]">Démarrez pour enregistrer une exécution réelle.</p>
      )}
    </GlassCard>
  );
}

function eventLabel(event: string): string {
  if (event === "call") return "appel";
  if (event === "return") return "retour";
  return "ligne";
}
