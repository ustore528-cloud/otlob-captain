/**
 * Decouples the HTTP client from the Zustand store to avoid circular imports.
 * Register once from `AuthProvider` before any authenticated request.
 */
export type TokenBridge = {
  getAccess: () => string | null;
  getRefresh: () => string | null;
  setTokens: (accessToken: string, refreshToken: string) => void | Promise<void>;
};

let bridge: TokenBridge | null = null;

export function registerTokenBridge(next: TokenBridge): void {
  bridge = next;
}

export function getTokenBridge(): TokenBridge | null {
  return bridge;
}

export function assertTokenBridge(): TokenBridge {
  const b = getTokenBridge();
  if (!b) {
    throw new Error("Token bridge not registered — call registerTokenBridge from AuthProvider");
  }
  return b;
}
