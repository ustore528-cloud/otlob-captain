import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

/** دائمًا مجلد `apps/web` — بغض النظر عن `process.cwd()` عند التشغيل من الجذر أو من الحزمة */
const webRoot = path.dirname(fileURLToPath(import.meta.url));

const apiPackageDir = path.resolve(webRoot, "../api");

/**
 * Where the dev/preview proxy should send `/api` and `/socket.io`.
 * - `VITE_API_PROXY_TARGET` in `apps/web/.env` wins if set.
 * - Otherwise use `PORT` from `apps/api/.env` (same monorepo layout) so the proxy matches the API process.
 * - Fallback 4000 matches `apps/api/.env.example` and the API env default.
 */
function resolveApiProxyTarget(mode: string, webEnv: Record<string, string>): string {
  const explicit = webEnv.VITE_API_PROXY_TARGET?.replace(/\/$/, "").trim();
  if (explicit) return explicit;

  const apiEnv = loadEnv(mode, apiPackageDir, "");
  const rawPort = apiEnv.PORT?.trim() ?? "";
  const port = Number.parseInt(rawPort, 10);
  const safePort = Number.isFinite(port) && port > 0 && port < 65536 ? port : 4000;
  return `http://127.0.0.1:${safePort}`;
}

/** Logs once on `vite dev` and `vite preview` (not during `vite build`). */
function apiProxyTargetLogPlugin(apiTarget: string): Plugin {
  const line = `[vite] API proxy → ${apiTarget} (override with VITE_API_PROXY_TARGET in apps/web/.env)`;
  return {
    name: "api-proxy-target-log",
    configureServer() {
      // eslint-disable-next-line no-console
      console.info(line);
    },
    configurePreviewServer() {
      // eslint-disable-next-line no-console
      console.info(line);
    },
  };
}

/** Use 127.0.0.1 to avoid localhost IPv6 quirks on Windows. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, "");
  const apiTarget = resolveApiProxyTarget(mode, env);

  const proxy: Record<string, { target: string; changeOrigin: boolean; ws?: boolean }> = {
    "/api": {
      target: apiTarget,
      changeOrigin: true,
    },
    "/socket.io": {
      target: apiTarget,
      changeOrigin: true,
      ws: true,
    },
  };

  return {
    root: webRoot,
    plugins: [apiProxyTargetLogPlugin(apiTarget), react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(webRoot, "./src"),
      },
    },
    server: {
      /** `true` → listen on `0.0.0.0` / `::` so both `http://127.0.0.1:5173` and `http://localhost:5173` work on Windows. */
      host: true,
      port: 5173,
      strictPort: true,
      proxy,
    },
    /** `vite preview` does not inherit `server.proxy` — repeat so `/api` still reaches the local API. */
    preview: {
      host: true,
      port: 4173,
      strictPort: true,
      proxy,
    },
  };
});
