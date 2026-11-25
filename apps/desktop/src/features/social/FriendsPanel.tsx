import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocialStore } from "@/shared/store/socialStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";

function Avatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return <img src={src} alt="" className="h-9 w-9 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-strong)] text-xs font-medium">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function FriendsPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const friends = useSocialStore((s) => s.snapshot.friends);
  const blocked = useSocialStore((s) => s.snapshot.blocked);
  const sendRequest = useSocialStore((s) => s.sendRequest);
  const openMessages = useSocialStore((s) => s.openMessages);
  const blockUser = useSocialStore((s) => s.blockUser);
  const unblockUser = useSocialStore((s) => s.unblockUser);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setSent(null);
    try {
      await sendRequest(username.trim());
      setSent(`Demande envoyée à ${username.trim()}.`);
      setUsername("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/45 px-4 py-16" onClick={onClose}>
      <div className="w-full max-w-lg" onClick={(event) => event.stopPropagation()}>
      <GlassCard className="max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Amis</h2>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Envoyez une demande avec le pseudo exact d'un compte. Les réponses se trouvent dans la messagerie.
        </p>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Pseudo exact"
            className="allow-select min-w-0 flex-1 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={busy || username.trim().length < 3}>Envoyer</Button>
        </form>
        {error ? <p className="mt-2 text-sm text-[var(--error)]">{error}</p> : null}
        {sent ? <p className="mt-2 text-sm text-[var(--success)]">{sent}</p> : null}
        <div className="mt-5 space-y-2">
          {friends.length === 0 ? (
            <p className="text-sm text-[var(--text-secondary)]">Aucun ami pour le moment.</p>
          ) : (
            friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] px-3 py-2">
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={() => {
                    onClose();
                    navigate(`/profil/${friend.id}`);
                  }}
                >
                  <Avatar src={friend.avatarData} name={friend.username} />
                  <span className="truncate font-medium">{friend.username}</span>
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" className="!px-2 !py-1" onClick={() => openMessages(friend.id)}>Écrire</Button>
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1"
                    onClick={() =>
                      void blockUser(friend.id)
                        .then(() => setSent(`${friend.username} a été bloqué.`))
                        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                    }
                  >
                    Bloquer
                  </Button>
                  <Button
                    variant="ghost"
                    className="!px-2 !py-1"
                    onClick={() => setSent("Signalement envoyé. Merci.")}
                  >
                    Signaler
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        {blocked.length > 0 ? (
          <div className="mt-5 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">Bloqués</p>
            {blocked.map((person) => (
              <div key={person.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] px-3 py-2">
                <span className="truncate text-sm">{person.username}</span>
                <Button
                  variant="ghost"
                  className="!px-2 !py-1"
                  onClick={() =>
                    void unblockUser(person.id)
                      .then(() => setSent(`${person.username} a été débloqué.`))
                      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
                  }
                >
                  Débloquer
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </GlassCard>
      </div>
    </div>
  );
}
