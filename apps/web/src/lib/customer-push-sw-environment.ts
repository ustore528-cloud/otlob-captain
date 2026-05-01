/** Customer Web Push / PWA service worker — safe to enable only for built assets (production `vite build` / `vite preview`). */
export function shouldRegisterCustomerPushServiceWorker(): boolean {
  return import.meta.env.PROD === true;
}
