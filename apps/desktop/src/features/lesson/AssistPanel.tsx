import { Button } from "@/shared/ui/Button";
import type { AssistResponse } from "@/shared/lib/assist";

type Props = {
  response: AssistResponse | null;
  onAsk: () => void;
  disabled?: boolean;
};

export function AssistPanel({ response, onAsk, disabled }: Props) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">Assistant pédagogique</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Demandez une explication progressive de l'erreur.
          </p>
        </div>
        <Button variant="secondary" onClick={onAsk} disabled={disabled}>
          Pourquoi mon programme ne fonctionne pas ?
        </Button>
      </div>

      {response ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="font-medium text-[var(--text)]">{response.title}</p>
          <p className="text-[var(--text-secondary)]">{response.explanation}</p>
          {response.lineHint ? (
            <p className="text-[var(--text-secondary)]">{response.lineHint}</p>
          ) : null}
          <p className="text-[var(--text-secondary)]">{response.tip}</p>
          {response.suggestedFix ? (
            <pre className="overflow-auto rounded-[12px] border border-[var(--border)] bg-[var(--bg-secondary)] p-3 font-mono text-[var(--text)]">
              {response.suggestedFix}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
