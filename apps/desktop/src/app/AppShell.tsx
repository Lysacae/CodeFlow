import { useState, type ReactNode } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AchievementToasts } from "@/features/profile/AchievementToasts";
import { RankUpToast } from "@/features/profile/RankUpToast";
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
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Spinner } from "@/shared/ui/Spinner";

const links = [
  { to: "/", label: "Tableau de bord", end: true },
  { to: "/revision", label: "Révision", end: false },
  { to: "/journal", label: "Journal", end: false },
  { to: "/leaderboard", label: "Classement", end: false },
  { to: "/notebook", label: "Carnet", end: false },
];

function Stroke({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const focusMode = useProgressStore((s) => s.focusMode);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [leaving, setLeaving] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
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
    <button type="button" className="icon-btn" title="Mise à jour disponible" aria-label="Mise à jour disponible" onClick={openUpdate}>
      <Stroke>
        <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
      </Stroke>
      <span className="dot" />
    </button>
  ) : null;
  const navLinks = isDevTesting(user?.username)
    ? [...links, { to: "/admin", label: "Admin", end: false }]
    : links;
  const showTutorial = progressionReady && (!tutorialDone || reviewTutorial);

  const leave = async () => {
    setLeaving(true);
    try {
      await logout();
      navigate("/auth");
    } finally {
      setLeaving(false);
      setConfirmLogout(false);
    }
  };

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      {!focusMode ? (
        <header className="topbar shrink-0">
          <div className="tb-left">
            <div className="pill-group">
              <button
                type="button"
                className="user-chip"
                title="Profil et succès"
                onClick={() => user && navigate(`/profil/${user.id}`)}
              >
                <span className="avatar orbit c1" style={{ ["--s" as string]: "30px" }}>
                  {user?.avatarData ? (
                    <img src={user.avatarData} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  ) : (
                    user?.username.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="name" style={{ color: "var(--text)" }}>{user?.username}</span>
                <img className="rank" src={rankIcon(rank.id)} width={24} height={24} alt={`Rang ${rank.name}`} />
              </button>
              <button type="button" className="icon-btn" title="Amis" aria-label="Amis" onClick={openFriends}>
                <Stroke>
                  <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
                  <circle cx="10" cy="7.5" r="3.5" />
                  <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6" />
                </Stroke>
              </button>
              <button type="button" className="icon-btn" title="Messagerie" aria-label="Messagerie" onClick={() => openMessages()}>
                <Stroke>
                  <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12Z" />
                  <path d="M8.5 11h7M8.5 14h4.5" />
                </Stroke>
                {incoming > 0 ? <span className="dot" /> : null}
              </button>
            </div>
          </div>

          <nav className="pill-group nav-pill">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="tb-right">
            <div className="pill-group">
              {updateButton}
              <button type="button" className="icon-btn" title="Paramètres" aria-label="Paramètres" onClick={() => navigate("/settings")}>
                <Stroke>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
                </Stroke>
              </button>
              <button type="button" className="logout" disabled={leaving} onClick={() => setConfirmLogout(true)}>
                {leaving ? <Spinner size="sm" /> : (
                  <Stroke size={16}>
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </Stroke>
                )}
                Déconnexion
              </button>
            </div>
          </div>
        </header>
      ) : updateButton ? (
        <div className="fixed right-4 top-3 z-30">{updateButton}</div>
      ) : null}

      <main className="cf-scroll">
        <Outlet />
      </main>

      {panel === "friends" ? <FriendsPanel onClose={closePanel} /> : null}
      {panel === "messages" ? <MessagesPanel onClose={closePanel} /> : null}
      <AchievementToasts />
      <RankUpToast />
      {confirmLogout ? (
        <ConfirmDialog
          title="Déconnexion"
          body="Êtes-vous sûr ?"
          confirmLabel={leaving ? "Déconnexion…" : "Déconnexion"}
          busy={leaving}
          onCancel={() => setConfirmLogout(false)}
          onConfirm={() => void leave()}
        />
      ) : null}
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
