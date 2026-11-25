import { create } from "zustand";
import {
  environmentsOnboardingDone,
  markEnvironmentsOnboardingDone,
} from "@/shared/lib/tauri";

type OnboardingState = {
  done: boolean | null;
  load: () => Promise<void>;
  markDone: () => Promise<void>;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  done: null,
  load: async () => {
    try {
      const done = await environmentsOnboardingDone();
      set({ done });
    } catch {
      set({ done: true });
    }
  },
  markDone: async () => {
    try {
      await markEnvironmentsOnboardingDone();
    } catch {
      /* le drapeau local reste la source de vérité au prochain essai */
    }
    set({ done: true });
  },
}));
