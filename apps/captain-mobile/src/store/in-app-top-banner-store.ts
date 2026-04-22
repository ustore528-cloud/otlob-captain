import { create } from "zustand";

export type InAppTopBannerKind = "order" | "alert" | "info";

export type InAppTopBannerItem = {
  id: string;
  title: string;
  message: string;
  kind: InAppTopBannerKind;
};

type InAppTopBannerState = {
  current: InAppTopBannerItem | null;
  showBanner: (item: Omit<InAppTopBannerItem, "id">) => string;
  dismissBanner: (id?: string) => void;
};

function nextId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useInAppTopBannerStore = create<InAppTopBannerState>((set) => ({
  current: null,
  showBanner: (item) => {
    const id = nextId();
    set({
      current: {
        id,
        title: item.title,
        message: item.message,
        kind: item.kind,
      },
    });
    return id;
  },
  dismissBanner: (id) =>
    set((s) => {
      if (!s.current) return s;
      if (id && s.current.id !== id) return s;
      return { current: null };
    }),
}));
