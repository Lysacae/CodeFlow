import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/AppShell";
import { AuthPage } from "@/features/auth/AuthPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PathPage } from "@/features/path/PathPage";
import { LessonPage } from "@/features/lesson/LessonPage";
import { NotebookPage } from "@/features/files/NotebookPage";
import { LeaderboardPage } from "@/features/leaderboard/LeaderboardPage";
import { QuizPage } from "@/features/quiz/QuizPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { AdminPage } from "@/features/admin/AdminPage";
import { JournalPage } from "@/features/journal/JournalPage";
import { PublicProfilePage } from "@/features/profile/PublicProfilePage";
import { RevisionPage } from "@/features/review/RevisionPage";
import { RuntimesPage } from "@/features/setup/RuntimesPage";
import { useAuthStore } from "@/shared/store/authStore";
import { useOnboardingStore } from "@/shared/store/onboardingStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { Spinner } from "@/shared/ui/Spinner";

function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function SetupGate({ children }: { children: React.ReactNode }) {
  const ready = useProgressStore((s) => s.ready);
  const onboardingDone = useOnboardingStore((s) => s.done);

  if (!ready || onboardingDone === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Chargement…" />
      </div>
    );
  }

  if (!onboardingDone) {
    return <Navigate to="/settings/runtimes" replace />;
  }

  return children;
}

export function AppRouter() {
  const user = useAuthStore((s) => s.user);

  return (
    <Routes>
      <Route
        path="/auth"
        element={user ? <Navigate to="/" replace /> : <AuthPage />}
      />
      <Route
        path="/settings/runtimes"
        element={
          <AuthGate>
            <RuntimesPage />
          </AuthGate>
        }
      />
      <Route
        element={
          <AuthGate>
            <SetupGate>
              <AppShell />
            </SetupGate>
          </AuthGate>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/learn/:languageId" element={<PathPage />} />
        <Route path="/learn/:languageId/quiz" element={<QuizPage />} />
        <Route path="/learn/:languageId/lesson/:lessonId" element={<LessonPage />} />
        <Route path="/notebook" element={<NotebookPage />} />
        <Route path="/revision" element={<RevisionPage />} />
        <Route path="/journal" element={<JournalPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profil/:userId" element={<PublicProfilePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? "/" : "/auth"} replace />} />
    </Routes>
  );
}
