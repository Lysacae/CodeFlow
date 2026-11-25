import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { AchievementToasts } from "@/features/profile/AchievementToasts";
import { FriendsPanel } from "@/features/social/FriendsPanel";
import { MessagesPanel } from "@/features/social/MessagesPanel";
import { TutorialModal } from "@/features/tutorial/TutorialModal";
import { rankById, rankIcon } from "@/shared/lib/ranks";
import { useAuthStore } from "@/shared/store/authStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { useSocialStore } from "@/shared/store/socialStore";
import { isDevTesting } from "@/shared/lib/devAccess";
import { useUpdateStore } from "@/shared/store/updateStore";
import { Button } from "@/shared/ui/Button";
import { Spinner } from "@/shared/ui/Spinner";

const links = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/revision", label: "Révision", end: false },
  { to: "/journal", label: "Journal", end: false },
  { to: "/leaderboard", label: "Classement", end: false },
  { to: "/notebook", label: "Carnet", end: false },
];

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42L11 12.59V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

function IconButton({
  label,
  onClick,
  badge,
  dot,
  children,
}: {
  label: string;
  onClick: () => void;
  badge?: number;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center rounded-[14px] border border-transparent text-[var(--text-secondary)] transition hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
    >
      {children}
      {badge && badge > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold leading-none text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      ) : dot ? (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--accent)]" />
      ) : null}
    </button>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const focusMode = useProgressStore((s) => s.focusMode);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [leaving, setLeaving] = useState(false);
  const panel = useSocialStore((s) => s.panel);
  const openFriends = useSocialStore((s) => s.openFriends);
  const openMessages = useSocialStore((s) => s.openMessages);
  const closePanel = useSocialStore((s) => s.close);
  const incoming = useSocialStore((s) => s.snapshot.incoming.length);
  const progressionReady = useProgressionStore((s) => s.ready);
  const tutorialDone = useProgressionStore((s) => s.doc.tutorialDone);
  const reviewTutorial = useProgressionStore((s) => s.reviewTutorial);
  const tutorialLanguage = useProgressionStore((s) => s.tutorialLanguage);
  const markTutorial = useProgressionStore((s) => s.markTutorial);
  const closeTutorial = useProgressionStore((s) => s.closeTutorial);
  const rank = rankById(useProgressionStore((s) => s.doc.rankId));
  const updateAvailable = useUpdateStore((s) => s.available);
  const openUpdate = useUpdateStore((s) => s.openDialog);
  const updateButton = updateAvailable ? (
    <IconButton label="Mise à jour disponible" dot onClick={openUpdate}>
      <DownloadIcon />
    </IconButton>
  ) : null;
  const navLinks = isDevTesting(user?.username)
    ? [...links, { to: "/admin", label: "Admin", end: false }]
    : links;
  const showTutorial = progressionReady && (!tutorialDone || reviewTutorial);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      {!focusMode ? (
        <header className="z-20 w-full shrink-0 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-xl">
          <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                onClick={() => user && navigate(`/profil/${user.id}`)}
                className="flex min-w-0 cursor-pointer items-center gap-2 rounded-[14px] border border-transparent px-2 py-1 transition hover:border-[var(--border)] hover:bg-[var(--surface)]"
                title="Profil et succès"
              >
                {user?.avatarData ? (
                  <img src={user.avatarData} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-strong)] text-xs font-medium">
                    {user?.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="max-w-[8rem] truncate text-sm text-[var(--text-secondary)]">
                  {user?.username}
                </span>
              </button>
              <span
                title={`Rang ${rank.name}`}
                aria-label={`Rang ${rank.name}`}
                className="flex h-10 cursor-default items-center gap-1 rounded-[14px] px-1.5 text-[var(--text-secondary)]"
              >
                <img src={rankIcon(rank.id)} alt="" className="cf-plain-icon h-7 w-7 object-contain" />
              </span>
              <IconButton label="Amis" onClick={openFriends}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M9 11a3.5 3.5 0 1 0-3.5-3.5A3.5 3.5 0 0 0 9 11Zm0-5a1.5 1.5 0 1 1-1.5 1.5A1.5 1.5 0 0 1 9 6Zm6.5 5a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0-4a1 1 0 1 1-1 1 1 1 0 0 1 1-1ZM9 12.5c-3.04 0-6 1.54-6 4.25V19h8.2a6.7 6.7 0 0 1-.2-1.5c0-1.9.8-3.4 2.1-4.5-1.1-.3-2.5-.5-4.1-.5Zm6.5 1c-2.5 0-5 1.2-5 3.4V19h10v-2.1c0-2.2-2.5-3.4-5-3.4Z" />
                </svg>
              </IconButton>
              <IconButton label="Messagerie" badge={incoming} onClick={() => openMessages()}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M4 5h16a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H9.2L4 21.5V7a2 2 0 0 1 2-2Zm2 3.2v.1l6 3.7 6-3.7V8.2H6Zm12 6.8V10.4l-5.4 3.3a1.2 1.2 0 0 1-1.2 0L6 10.4V15h12Z" />
                </svg>
              </IconButton>
            </div>

            <nav className="flex shrink items-center gap-1 overflow-x-auto rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-1">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  className={({ isActive }) =>
                    clsx(
                      "whitespace-nowrap rounded-[12px] px-3 py-2 text-sm transition",
                      isActive
                        ? "bg-[var(--surface-strong)] text-[var(--text)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text)]",
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              {updateButton}
              <IconButton label="Paramètres" onClick={() => navigate("/settings")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z" />
                </svg>
              </IconButton>
              <Button
                variant="ghost"
                disabled={leaving}
                onClick={async () => {
                  setLeaving(true);
                  try {
                    await logout();
                    navigate("/auth");
                  } finally {
                    setLeaving(false);
                  }
                }}
              >
                {leaving ? <Spinner size="sm" /> : null}
                Déconnexion
              </Button>
            </div>
          </div>
        </header>
      ) : updateButton ? (
        <div className="fixed right-4 top-3 z-30">{updateButton}</div>
      ) : null}

      <main className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-6 py-8">
        <Outlet />
      </main>

      {panel === "friends" ? <FriendsPanel onClose={closePanel} /> : null}
      {panel === "messages" ? <MessagesPanel onClose={closePanel} /> : null}
      <AchievementToasts />
      {showTutorial ? (
        <TutorialModal
          languageId={tutorialLanguage}
          canSkip={tutorialDone}
          onDone={() => void markTutorial()}
          onClose={closeTutorial}
        />
      ) : null}
    </div>
  );
}
