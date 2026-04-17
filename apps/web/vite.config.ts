import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

/** دائمًا مجلد `apps/web` — بغض النظر عن `process.cwd()` عند التشغيل من الجذر أو من الحزمة */
const webRoot = path.dirname(fileURLToPath(import.meta.url));

/** Must match `PORT` in apps/api/.env (default 4000). Use 127.0.0.1 to avoid localhost IPv6 quirks on Windows. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, webRoot, "");
  const apiTarget =
    env.VITE_API_PROXY_TARGET?.replace(/\/$/, "") || "http://127.0.0.1:4000";

  return {
    root: webRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(webRoot, "./src"),
      },
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/socket.io": {
          target: apiTarget,
          ws: true,
        },
      },
    },
  };
});
