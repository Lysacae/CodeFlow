import { getLanguage } from "@/shared/lib/content";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";

const STEPS = [
  "CodeFlow s'organise en parcours. Choisissez un langage sur le tableau de bord, puis ouvrez les leçons dans l'ordre.",
  "Lisez le cours, puis exécutez l'exercice. La sortie doit correspondre exactement au texte attendu.",
  "Les questions / réponses se débloquent sur la page du langage. La première maîtrise rapporte de l'expérience, les répétitions beaucoup moins.",
  "Le classement, les amis et la messagerie sont dans l'en-tête. Le tutoriel ne revient plus tout seul : ce bouton du parcours permet de le revoir.",
];

type Props = {
  languageId?: string | null;
  canSkip: boolean;
  onDone: () => void;
  onClose: () => void;
};

export function TutorialModal({ languageId, canSkip, onDone, onClose }: Props) {
  const language = languageId ? getLanguage(languageId) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-4 py-8">
      <GlassCard className="max-h-[86vh] w-full max-w-2xl overflow-y-auto">
        <h2 className="text-xl font-semibold">Tutoriel</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {canSkip
            ? "Vous pouvez passer ce rappel."
            : "Ce tutoriel est obligatoire une fois par compte."}
          {language ? ` Parcours ${language.name}.` : ""}
        </p>
        <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
          {STEPS.map((step) => (
            <p key={step}>{step}</p>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {canSkip ? (
            <Button variant="secondary" onClick={onClose}>Passer</Button>
          ) : null}
          <Button onClick={onDone}>{canSkip ? "Fermer" : "J'ai compris"}</Button>
        </div>
      </GlassCard>
    </div>
  );
}
