import { useEffect, useRef, useState } from "react";
import { fileToAvatarDataUrl } from "@/shared/lib/avatar";
import { useAuthStore } from "@/shared/store/authStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { PasswordField } from "@/shared/ui/PasswordField";
import { Spinner } from "@/shared/ui/Spinner";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ProfileModal({ open, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const [username, setUsername] = useState(user?.username ?? "");
  const [avatarData, setAvatarData] = useState<string | null>(user?.avatarData ?? null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const current = useAuthStore.getState().user;
    if (!current) return;
    setUsername(current.username);
    setAvatarData(current.avatarData);
    setCurrentPassword("");
    setPassword("");
    setError(null);
    setOk(null);
  }, [open]);

  if (!open || !user) return null;

  const save = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const nextPassword = password.trim();
      if (nextPassword && !currentPassword) {
        throw new Error("Indiquez votre mot de passe actuel.");
      }
      await updateProfile({ username: username.trim(), avatarData });
      if (nextPassword) {
        await updatePassword(currentPassword, nextPassword);
        setCurrentPassword("");
        setPassword("");
      }
      setOk(nextPassword ? "Profil et mot de passe mis à jour." : "Profil mis à jour.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/55 px-6 py-8 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Mon profil</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Pseudo, mot de passe et photo.
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Fermer
          </Button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)]"
          >
            {avatarData ? (
              <img src={avatarData} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-[var(--text-secondary)]">Photo</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void fileToAvatarDataUrl(file)
                .then((data) => {
                  setError(null);
                  setAvatarData(data);
                })
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Impossible de lire l'image."),
                );
            }}
          />
          <p className="text-xs text-[var(--text-secondary)]">2 Mo maximum</p>
          {avatarData ? (
            <button
              type="button"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
              onClick={() => setAvatarData(null)}
            >
              Retirer la photo
            </button>
          ) : null}
        </div>

        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Pseudo"
          className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />

        <div className="space-y-2">
          <PasswordField
            value={currentPassword}
            onChange={setCurrentPassword}
            placeholder="Mot de passe actuel"
            autoComplete="current-password"
          />
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="Nouveau mot de passe"
            autoComplete="new-password"
          />
          <p className="text-xs text-[var(--text-secondary)]">
            Pour changer le mot de passe, saisissez l'ancien puis le nouveau.
          </p>
        </div>

        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}
        {ok ? <p className="text-sm text-[var(--success)]">{ok}</p> : null}

        <Button className="w-full" onClick={() => void save()} disabled={busy}>
          {busy ? <Spinner size="sm" /> : null}
          {busy ? "Enregistrement…" : "Enregistrer"}
        </Button>

      </GlassCard>
    </div>
  );
}
