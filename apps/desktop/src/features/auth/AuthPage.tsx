import { useRef, useState } from "react";
import { fileToAvatarDataUrl } from "@/shared/lib/avatar";
import { recoverLocalPassword, recoverLocalUsername } from "@/shared/lib/tauri";
import { useAuthStore } from "@/shared/store/authStore";
import { Button } from "@/shared/ui/Button";
import { GlassCard } from "@/shared/ui/GlassCard";
import { PasswordField } from "@/shared/ui/PasswordField";
import { Spinner } from "@/shared/ui/Spinner";

type RecoverMode = "password" | "username" | null;

export function AuthPage() {
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoverMode, setRecoverMode] = useState<RecoverMode>(null);
  const [recoverUser, setRecoverUser] = useState("");
  const [recovered, setRecovered] = useState<string | null>(null);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [recoverBusy, setRecoverBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password, avatarData);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const openRecover = (next: RecoverMode) => {
    setRecoverMode(next);
    setRecovered(null);
    setRecoverError(null);
    setRecoverUser(username);
  };

  const revealPassword = async () => {
    setRecoverBusy(true);
    setRecovered(null);
    setRecoverError(null);
    try {
      const value = await recoverLocalPassword(recoverUser);
      setRecovered(value);
    } catch (e) {
      setRecoverError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecoverBusy(false);
    }
  };

  const revealUsername = async () => {
    setRecoverBusy(true);
    setRecovered(null);
    setRecoverError(null);
    try {
      const value = await recoverLocalUsername();
      setRecovered(value);
      setUsername(value);
    } catch (e) {
      setRecoverError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecoverBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center overflow-y-auto px-6 py-10">
      <GlassCard className="w-full max-w-md space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,var(--accent),var(--accent-secondary))] text-sm font-bold text-white">
            CF
          </div>
          <h1 className="text-2xl font-semibold">CodeFlow</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </p>
        </div>

        <div className="flex gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-1">
          <button
            type="button"
            className={`flex-1 rounded-[10px] px-3 py-2 text-sm ${
              mode === "login"
                ? "bg-[var(--surface-strong)] text-[var(--text)]"
                : "text-[var(--text-secondary)]"
            }`}
            onClick={() => setMode("login")}
          >
            Se connecter
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[10px] px-3 py-2 text-sm ${
              mode === "register"
                ? "bg-[var(--surface-strong)] text-[var(--text)]"
                : "text-[var(--text-secondary)]"
            }`}
            onClick={() => setMode("register")}
          >
            Créer un compte
          </button>
        </div>

        {mode === "register" ? (
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
            <p className="text-xs text-[var(--text-secondary)]">Photo facultative · 2 Mo maximum</p>
          </div>
        ) : null}

        <div className="space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Pseudo"
            autoComplete="username"
            className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
          />
          <PasswordField
            value={password}
            onChange={setPassword}
            placeholder="Mot de passe"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
          />
        </div>

        {mode === "login" ? (
          <div className="flex justify-between gap-3 text-xs">
            <button
              type="button"
              className="text-[var(--text-secondary)] hover:text-[var(--text)]"
              onClick={() => openRecover(recoverMode === "password" ? null : "password")}
            >
              Mot de passe oublié
            </button>
            <button
              type="button"
              className="text-[var(--text-secondary)] hover:text-[var(--text)]"
              onClick={() => openRecover(recoverMode === "username" ? null : "username")}
            >
              Pseudo oublié
            </button>
          </div>
        ) : null}

        {mode === "login" && recoverMode === "password" ? (
          <div className="space-y-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Saisissez le pseudo utilisé sur cet ordinateur pour afficher le mot de passe
              enregistré.
            </p>
            <input
              value={recoverUser}
              onChange={(e) => setRecoverUser(e.target.value)}
              placeholder="Pseudo"
              className="w-full rounded-[14px] border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
            <Button className="w-full" onClick={() => void revealPassword()} disabled={recoverBusy}>
              {recoverBusy ? <Spinner size="sm" /> : null}
              Afficher le mot de passe
            </Button>
            {recovered ? (
              <p className="text-sm">
                Mot de passe : <span className="font-mono text-[var(--text)]">{recovered}</span>
              </p>
            ) : null}
            {recoverError ? <p className="text-sm text-[var(--error)]">{recoverError}</p> : null}
          </div>
        ) : null}

        {mode === "login" && recoverMode === "username" ? (
          <div className="space-y-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Affiche le pseudo enregistré sur cet ordinateur.
            </p>
            <Button className="w-full" onClick={() => void revealUsername()} disabled={recoverBusy}>
              {recoverBusy ? <Spinner size="sm" /> : null}
              Afficher le pseudo
            </Button>
            {recovered ? (
              <p className="text-sm">
                Pseudo : <span className="font-medium text-[var(--text)]">{recovered}</span>
              </p>
            ) : null}
            {recoverError ? <p className="text-sm text-[var(--error)]">{recoverError}</p> : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-[var(--error)]">{error}</p> : null}

        <Button className="w-full" onClick={() => void submit()} disabled={busy}>
          {busy ? <Spinner size="sm" /> : null}
          {busy
            ? mode === "login"
              ? "Connexion…"
              : "Création…"
            : mode === "login"
              ? "Connexion"
              : "Créer le compte"}
        </Button>
      </GlassCard>
    </div>
  );
}
