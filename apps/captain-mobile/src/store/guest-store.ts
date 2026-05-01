import { create } from "zustand";
import { clearGuestStorage, loadGuestFlag, persistGuestFlag } from "@/features/guest/storage/guest-storage";

type GuestState = {
  isGuest: boolean;
  guestReady: boolean;
};

type GuestActions = {
  hydrateFromBootstrap: (opts: { authenticated: boolean }) => Promise<void>;
  enterGuest: () => Promise<void>;
  exitGuest: () => Promise<void>;
};

export const useGuestStore = create<GuestState & GuestActions>((set) => ({
  isGuest: false,
  guestReady: false,

  hydrateFromBootstrap: async ({ authenticated }) => {
    if (authenticated) {
      await clearGuestStorage();
      set({ isGuest: false, guestReady: true });
      return;
    }
    const isGuest = await loadGuestFlag();
    set({ isGuest, guestReady: true });
  },

  enterGuest: async () => {
    await persistGuestFlag();
    set({ isGuest: true, guestReady: true });
  },

  exitGuest: async () => {
    await clearGuestStorage();
    set({ isGuest: false });
  },
}));
