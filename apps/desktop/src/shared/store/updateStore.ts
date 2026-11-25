import { create } from "zustand";
import type { LatestUpdate } from "@/shared/lib/api";

type UpdateState = {
  available: LatestUpdate | null;
  dialogOpen: boolean;
  setAvailable: (update: LatestUpdate | null) => void;
  openDialog: () => void;
  closeDialog: () => void;
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  available: null,
  dialogOpen: false,
  setAvailable: (update) => set({ available: update, dialogOpen: Boolean(update) }),
  openDialog: () => {
    if (get().available) set({ dialogOpen: true });
  },
  closeDialog: () => set({ dialogOpen: false }),
}));
