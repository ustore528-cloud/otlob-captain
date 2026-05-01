import { useEffect } from "react";

const TITLE = "2in Order";

/**
 * Applies customer-order PWA metadata on public flows; restores dashboard defaults on cleanup.
 */
export function useCustomerOrderPwaMeta() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = TITLE;

    const ensureLink = (rel: string) => {
      let node = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!node) {
        node = document.createElement("link");
        node.rel = rel;
        document.head.appendChild(node);
      }
      return node;
    };

    const manifestLink = ensureLink("manifest");
    const prevManifest = manifestLink.getAttribute("href") ?? "/manifest.webmanifest";
    manifestLink.setAttribute("href", "/customer-order-manifest.webmanifest");

    /** Single apple-touch entry used on customer flows */
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((n) => n.remove());
    const apple = ensureLink("apple-touch-icon");
    apple.setAttribute("href", "/customer-order-icon-180.png");

    const themeMeta =
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]') ??
      (() => {
        const n = document.createElement("meta");
        n.setAttribute("name", "theme-color");
        document.head.appendChild(n);
        return n;
      })();
    const prevTheme = themeMeta.getAttribute("content") ?? "";
    themeMeta.setAttribute("content", "#0f172a");

    let appleCapable = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-capable"]');
    const hadAppleCapable = Boolean(appleCapable);
    if (!appleCapable) {
      appleCapable = document.createElement("meta");
      appleCapable.setAttribute("name", "apple-mobile-web-app-capable");
      document.head.appendChild(appleCapable);
    }
    const prevCapable = appleCapable?.getAttribute("content") ?? "";
    appleCapable?.setAttribute("content", "yes");

    let appleStyle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!appleStyle) {
      appleStyle = document.createElement("meta");
      appleStyle.setAttribute("name", "apple-mobile-web-app-status-bar-style");
      document.head.appendChild(appleStyle);
    }
    const prevAppleStyle = appleStyle.getAttribute("content") ?? "";
    appleStyle.setAttribute("content", "default");

    return () => {
      document.title = prevTitle;
      manifestLink.setAttribute("href", prevManifest);

      document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((n) => n.remove());

      /** Dashboard baseline icons from index.html / manifest.webmanifest */
      const dashApple = ensureLink("apple-touch-icon");
      dashApple.setAttribute("href", "/icon-192.png");

      themeMeta.setAttribute("content", prevTheme);
      if (hadAppleCapable) appleCapable?.setAttribute("content", prevCapable || "yes");
      else appleCapable?.remove();
      appleStyle.setAttribute("content", prevAppleStyle);
    };
  }, []);
}
