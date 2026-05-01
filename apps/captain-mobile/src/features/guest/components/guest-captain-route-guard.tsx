import { useRouter, type Href } from "expo-router";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { showGuestLoginRequiredAlert } from "@/features/guest/guest-login-required-alert";

/**
 * Guests must never mount captain tooling. When routing tries to render the authenticated
 * app group (deep link / stale history), explain why and send them somewhere safe without
 * exposing APIs or sockets.
 */
export function GuestCaptainRouteGuard() {
  const router = useRouter();
  const { t } = useTranslation();
  const showed = useRef(false);

  useLayoutEffect(() => {
    if (showed.current) return;
    showed.current = true;
    showGuestLoginRequiredAlert({
      t,
      onStayGuest: () => {
        router.replace("/(guest)/home" as Href);
      },
      onSignIn: () => {
        router.replace("/(auth)/login" as Href);
      },
    });
  }, [router, t]);

  return null;
}
