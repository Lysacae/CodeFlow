import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { languages } from "@/shared/lib/content";
import {
  errorLabel,
  recurrentKeys,
  type ErrorKind,
  type JournalEntry,
} from "@/shared/lib/errorJournal";
import { patchJournal, postponeNotion } from "@/shared/lib/learning";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";

const KINDS: ErrorKind[] = [
  "syntax",
  "undefined",
  "type",
  "condition",
  "loop",
  "function",
  "logic",
  "result",
  "runtime",
  "misunderstanding",
];

export function JournalPage() {
  const navigate = useNavigate();
  const journal = useProgressionStore((s) => s.doc.learning.journal);
  const updateLearning = useProgressionStore((s) => s.updateLearning);
  const [languageId, setLanguageId] = useState("all");
  const [chapter, setChapter] = useState("all");
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [recurrentOnly, setRecurrentOnly] = useState(false);

  const recurrent = useMemo(() => recurrentKeys(journal), [journal]);
  const recurrentSet = useMemo(() => new Set(recurrent.map((item) => item.key)), [recurrent]);

  const rows = journal.filter((entry) => {
    if (languageId !== "all" && entry.languageId !== languageId) return false;
    if (chapter !== "all" && String(entry.chapter) !== chapter) return false;
    if (kind !== "all" && entry.kind !== kind) return false;
    if (recurrentOnly && !recurrentSet.has(`${entry.languageId}|${entry.lessonId}|${entry.kind}`)) return false;
    if (!query.trim()) return true;
    const hay = `${entry.lessonTitle} ${entry.message} ${entry.expected} ${entry.got}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Journal des erreurs</h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          Seulement les échecs réellement rencontrés dans les exercices. Rien n'est inventé.
        </p>
      </div>

      <GlassCard className="grid gap-3 md:grid-cols-4">
        <select className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2" value={languageId} onChange={(e) => setLanguageId(e.target.value)}>
          <option value="all">Tous les langages</option>
          {languages.map((lang) => (
            <option key={lang.id} value={lang.id}>{lang.name}</option>
          ))}
        </select>
        <select className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2" value={chapter} onChange={(e) => setChapter(e.target.value)}>
          <option value="all">Tous les chapitres</option>
          <option value="1">Chapitre 1</option>
          <option value="2">Chapitre 2</option>
          <option value="3">Chapitre 3</option>
        </select>
        <select className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">Tous les types</option>
          {KINDS.map((item) => (
            <option key={item} value={item}>{errorLabel(item)}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher"
          className="rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2 outline-none"
        />
        <label className="flex items-center gap-2 text-sm md:col-span-4">
          <input type="checkbox" checked={recurrentOnly} onChange={(e) => setRecurrentOnly(e.target.checked)} />
          Erreurs récurrentes seulement
        </label>
      </GlassCard>

      {recurrent.length > 0 ? (
        <GlassCard className="space-y-2">
          <h2 className="font-semibold">À retravailler</h2>
          {recurrent.map((item) => (
            <p key={item.key} className="text-sm text-[var(--text-secondary)]">
              {item.lessonTitle} · {errorLabel(item.kind)} · {item.count} fois. Une révision ciblée est plus utile qu'un nouvel essai au hasard.
            </p>
          ))}
        </GlassCard>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">Aucune erreur enregistrée pour ce filtre.</p>
      ) : (
        rows.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onOpen={() => navigate(`/learn/${entry.languageId}/lesson/${entry.lessonId}`)}
            onUnderstood={() => updateLearning((state) => patchJournal(state, entry.id, { understood: true, reviewLater: false }))}
            onLater={() =>
              updateLearning((state) => {
                const patched = patchJournal(state, entry.id, { reviewLater: true });
                return postponeNotion(patched, `${entry.languageId}:${entry.lessonId}`);
              })
            }
          />
        ))
      )}
    </div>
  );
}

function EntryCard({
  entry,
  onOpen,
  onUnderstood,
  onLater,
}: {
  entry: JournalEntry;
  onOpen: () => void;
  onUnderstood: () => void;
  onLater: () => void;
}) {
  const lang = languages.find((item) => item.id === entry.languageId);
  return (
    <GlassCard className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{entry.lessonTitle}</p>
          <p className="text-sm text-[var(--text-secondary)]">
            {lang?.name ?? entry.languageId} · chapitre {entry.chapter} · {errorLabel(entry.kind)} · {new Date(entry.at).toLocaleString("fr-FR")}
          </p>
        </div>
        {entry.understood ? <span className="text-sm text-[var(--success)]">Compris</span> : null}
      </div>
      <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{entry.message}</p>
      <p className="text-sm">
        Attendu : <code>{entry.expected || "—"}</code>
      </p>
      <p className="text-sm">
        Obtenu : <code>{entry.got || "—"}</code>
      </p>
      <p className="text-xs text-[var(--text-secondary)]">
        Tentative {entry.attempts} · indices {entry.hintsUsed}
        {entry.solutionConsulted ? " · solution consultée" : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onOpen}>Reprendre l'exercice</Button>
        <Button variant="secondary" disabled={entry.understood} onClick={onUnderstood}>J'ai compris</Button>
        <Button variant="ghost" onClick={onLater}>Revoir plus tard</Button>
      </div>
    </GlassCard>
  );
}
