import { useRouter, type Href } from "expo-router";
import { useCallback } from "react";

/**
 * Back from hidden tool screens (profile, earnings, tracking, home) opened via الإعدادات.
 * Falls back to the settings tab if there is no history entry.
 */
export function useInnerToolBack(fallback: Href = "/(app)/(tabs)/settings") {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
