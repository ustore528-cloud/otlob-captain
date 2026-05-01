/**
 * Customer push only — no fetch handler so API/HTML are never cached here.
 * No secrets; URLs come from encrypted push payloads from the server.
 */
// eslint-disable-next-line no-restricted-globals
const worker = globalThis.self;

worker.addEventListener("install", () => {
  worker.skipWaiting();
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(worker.clients.claim());
});

/**
 * Resolve open URL from push JSON: prefer explicit url, then trackingToken → /track/<token>.
 */
function resolveOpenUrl(parsed) {
  const data =
    parsed && typeof parsed.data === "object" && parsed.data !== null ? parsed.data : {};
  const trackingToken =
    typeof data.trackingToken === "string"
      ? data.trackingToken.trim()
      : typeof parsed.trackingToken === "string"
        ? parsed.trackingToken.trim()
        : "";

  let rawUrl = "";
  if (typeof parsed.url === "string" && parsed.url.trim() !== "") {
    rawUrl = parsed.url.trim();
  } else if (typeof data.url === "string" && data.url.trim() !== "") {
    rawUrl = data.url.trim();
  } else if (trackingToken) {
    rawUrl = `/track/${encodeURIComponent(trackingToken)}`;
  } else {
    rawUrl = "/";
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }
  const path = rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  return `${worker.location.origin}${path}`;
}

worker.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let parsed = {};
      try {
        const rawTxt = typeof event?.data?.text === "function" ? event.data.text() : "";
        const text =
          typeof rawTxt === "string" ? rawTxt : rawTxt instanceof Promise ? await rawTxt : "";
        parsed = typeof text === "string" && text.trim() !== "" ? JSON.parse(text) : {};
      } catch {
        parsed = {};
      }

      const title = typeof parsed.title === "string" ? parsed.title : "Order update";
      const body = typeof parsed.body === "string" ? parsed.body : "";
      const tag = typeof parsed.tag === "string" ? parsed.tag : undefined;
      const targetAbs = resolveOpenUrl(parsed);
      const pushData =
        parsed && typeof parsed.data === "object" && parsed.data !== null ? parsed.data : {};

      const titleKey = typeof parsed.titleKey === "string" ? parsed.titleKey : "";
      const bodyKey = typeof parsed.bodyKey === "string" ? parsed.bodyKey : "";
      const status = typeof parsed.status === "string" ? parsed.status : "";
      const updatedAt = typeof parsed.updatedAt === "string" ? parsed.updatedAt : "";
      const trackingTok =
        typeof parsed.trackingToken === "string"
          ? parsed.trackingToken.trim()
          : typeof pushData.trackingToken === "string"
            ? pushData.trackingToken.trim()
            : "";

      await worker.registration.showNotification(title, {
        body,
        data: {
          url: targetAbs,
          ...(titleKey ? { titleKey } : {}),
          ...(bodyKey ? { bodyKey } : {}),
          ...(status ? { status } : {}),
          ...(updatedAt ? { updatedAt } : {}),
          ...(trackingTok ? { trackingToken: trackingTok } : {}),
        },
        ...(tag ? { tag } : {}),
      });
    })(),
  );
});

worker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl =
    typeof event.notification?.data?.url === "string" ? event.notification.data.url.trim() : "";
  const targetAbs = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : worker.location.origin + (rawUrl.startsWith("/") ? rawUrl : `/${rawUrl || ""}`);

  event.waitUntil(
    worker.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      let target;
      try {
        target = new URL(targetAbs);
      } catch {
        return worker.clients.openWindow(worker.location.origin + "/");
      }

      for (const client of clientList) {
        try {
          const u = new URL(client.url);
          if (
            u.origin === target.origin &&
            u.pathname === target.pathname &&
            u.search === target.search
          ) {
            return client.focus();
          }
        } catch {
          /* skip */
        }
      }

      for (const client of clientList) {
        try {
          const u = new URL(client.url);
          if (
            u.origin === target.origin &&
            typeof client.navigate === "function"
          ) {
            return Promise.resolve(client.navigate(targetAbs))
              .then(() => client.focus())
              .catch(() => (worker.clients.openWindow ? worker.clients.openWindow(targetAbs) : undefined));
          }
        } catch {
          /* skip */
        }
      }

      if (worker.clients.openWindow) {
        return worker.clients.openWindow(targetAbs);
      }
      return Promise.resolve(undefined);
    }),
  );
});
