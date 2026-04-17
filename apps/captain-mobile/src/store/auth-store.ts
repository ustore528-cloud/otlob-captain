import { create } from "zustand";
import type { LoginCaptainResponse, MeResponse } from "@/services/api/dto";
import { ApiClientError } from "@/services/api/errors";
import { authService } from "@/services/api/services/auth.service";
import { captainService } from "@/services/api/services/captain.service";
import {
  clearAuthStorage,
  loadSnapshot,
  loadStoredTokens,
  persistSnapshot,
  persistTokens,
} from "@/features/auth/storage/auth-storage";
import type { CaptainProfile, SessionSnapshot, SessionUser } from "@/features/auth/types";
import { queryClient } from "@/lib/query-client";
import { connectCaptainSocket, disconnectCaptainSocket } from "@/services/socket/socket-client";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  captain: CaptainProfile | null;
  sessionReady: boolean;
};

type AuthActions = {
  bootstrap: () => Promise<void>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

function meToSnapshot(me: MeResponse): SessionSnapshot {
  return {
    user: me.user,
    captain: me.captain,
  };
}

function loginResponseToSnapshot(data: LoginCaptainResponse): SessionSnapshot {
  return {
    user: {
      id: data.user.id,
      fullName: data.user.fullName,
      phone: data.user.phone,
      email: null,
      role: data.user.role,
      isActive: true,
    },
    captain: {
      id: data.captain.id,
      vehicleType: data.captain.vehicleType,
      area: data.captain.area,
      availabilityStatus: data.captain.availabilityStatus,
      isActive: data.captain.isActive,
      lastSeenAt: data.captain.lastSeenAt ?? null,
    },
  };
}

function toLoginBody(identifier: string, password: string) {
  const id = identifier.trim();
  if (id.includes("@")) {
    return { email: id, password };
  }
  return { phone: id, password };
}

async function clearSessionInternal(set: (partial: Partial<AuthState>) => void) {
  disconnectCaptainSocket();
  await clearAuthStorage();
  set({
    accessToken: null,
    refreshToken: null,
    user: null,
    captain: null,
  });
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  captain: null,
  sessionReady: false,

  bootstrap: async () => {
    set({ sessionReady: false });
    try {
      const { accessToken: accessFromStore, refreshToken: refreshFromStore } = await loadStoredTokens();
      const snapshot = await loadSnapshot();

      if (snapshot) {
        set({
          user: snapshot.user,
          captain: snapshot.captain,
        });
      }

      set({
        accessToken: accessFromStore,
        refreshToken: refreshFromStore,
      });

      if (!accessFromStore && !refreshFromStore) {
        set({ sessionReady: true });
        return;
      }

      let access = accessFromStore;
      let refresh = refreshFromStore;

      if (!access && refresh) {
        const t = await authService.refresh(refresh);
        access = t.accessToken;
        refresh = t.refreshToken;
        await persistTokens(access, refresh);
        set({ accessToken: access, refreshToken: refresh });
      }

      if (!access) {
        await clearSessionInternal(set);
        set({ sessionReady: true });
        return;
      }

      try {
        const me = await captainService.getMe();
        await persistSnapshot(meToSnapshot(me));
        set({
          user: me.user,
          captain: me.captain,
          sessionReady: true,
        });
        const socketToken = useAuthStore.getState().accessToken;
        if (socketToken) {
          connectCaptainSocket(socketToken);
        }
      } catch (e) {
        const fatal =
          e instanceof ApiClientError &&
          (e.status === 401 || e.status === 403 || e.status === 404);
        if (fatal) {
          await clearSessionInternal(set);
        }
        set({ sessionReady: true });
      }
    } catch {
      await clearSessionInternal(set);
      set({ sessionReady: true });
    }
  },

  signIn: async (identifier: string, password: string) => {
    const body = toLoginBody(identifier, password);
    const data = await authService.login(body);
    const snapshot = loginResponseToSnapshot(data);
    await persistTokens(data.accessToken, data.refreshToken);
    await persistSnapshot(snapshot);
    set({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: snapshot.user,
      captain: snapshot.captain,
    });
    connectCaptainSocket(data.accessToken);
  },

  signOut: async () => {
    queryClient.clear();
    await clearSessionInternal(set);
  },
}));

export function selectIsAuthenticated(s: AuthState): boolean {
  return Boolean(s.accessToken && s.user && s.captain);
}
