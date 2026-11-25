import { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "@/app/router";
import { DiscordPresence } from "@/features/discord/DiscordPresence";
import { SocialToasts } from "@/features/social/SocialToasts";
import { UpdateDialog } from "@/features/update/UpdateDialog";
import { apiLatestUpdate } from "@/shared/lib/api";
import { APP_VERSION, isNewerVersion } from "@/shared/lib/version";
import { useUpdateStore } from "@/shared/store/updateStore";
import { useAuthStore } from "@/shared/store/authStore";
import { useOnboardingStore } from "@/shared/store/onboardingStore";
import { useProgressStore } from "@/shared/store/progressStore";
import { useProgressionStore } from "@/shared/store/progressionStore";
import { useSocialStore } from "@/shared/store/socialStore";
import { Spinner } from "@/shared/ui/Spinner";

export default function App() {
  const authReady = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const loadSession = useAuthStore((s) => s.loadSession);
  const loadProgress = useProgressStore((s) => s.load);
  const progress = useProgressStore((s) => s.progress);
  const progressReady = useProgressStore((s) => s.ready);
  const onboardingDone = useOnboardingStore((s) => s.done);
  const loadOnboarding = useOnboardingStore((s) => s.load);
  const update = useUpdateStore((s) => s.available);
  const dialogOpen = useUpdateStore((s) => s.dialogOpen);
  const setAvailable = useUpdateStore((s) => s.setAvailable);
  const closeDialog = useUpdateStore((s) => s.closeDialog);

  useEffect(() => {
    void loadSession();
    void loadOnboarding();
  }, [loadSession, loadOnboarding]);

  useEffect(() => {
    if (user) {
      void loadProgress();
    }
  }, [user, loadProgress]);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) {
      useSocialStore.getState().stop();
      useProgressionStore.getState().reset();
      return;
    }
    void useProgressionStore.getState().load(userId);
    useSocialStore.getState().start();
    return () => {
      useSocialStore.getState().stop();
    };
  }, [userId]);

  useEffect(() => {
    if (!user || !progressReady) return;
    void useProgressionStore.getState().reconcile();
  }, [user, progressReady, progress]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const latest = await apiLatestUpdate();
        if (
          !cancelled &&
          latest.version &&
          latest.downloadUrl &&
          isNewerVersion(latest.version, APP_VERSION)
        ) {
          setAvailable(latest);
        }
      } catch {
        /* serveur updates optionnel au démarrage */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setAvailable]);

  if (!authReady || onboardingDone === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Chargement…" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
      <BrowserRouter>
        <DiscordPresence />
        {update && dialogOpen ? (
          <UpdateDialog update={update} onLater={closeDialog} />
        ) : null}
        <AppRouter />
        <SocialToasts />
      </BrowserRouter>
    </div>
  );
}
