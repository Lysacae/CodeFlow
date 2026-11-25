import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { getLanguage } from "@/shared/lib/content";

/** Met à jour la présence Discord selon le langage ouvert. */
export function DiscordPresence() {
  const { pathname } = useLocation();

  useEffect(() => {
    const match = pathname.match(/^\/learn\/([^/]+)/);
    const language = match ? getLanguage(decodeURIComponent(match[1])) : undefined;
    const details = language ? `Apprend ${language.name}` : "Apprend à coder";
    void invoke("discord_set_presence", { details, state: "CodeFlow" }).catch(() => {
      /* Discord fermé, ou identifiant d'application pas encore configuré */
    });
  }, [pathname]);

  return null;
}
