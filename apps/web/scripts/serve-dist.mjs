/**
 * Serves Vite `dist` on 0.0.0.0:PORT (Railway / `serve` static hosting).
 * Avoids shell `$PORT` expansion issues on Windows; uses the workspace `serve` install.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const port = process.env.PORT ?? "3000";
const serveMain = require.resolve("serve/build/main.js");

const child = spawn(
  process.execPath,
  [serveMain, "-s", "-l", String(port), "--no-port-switching", dist],
  { stdio: "inherit", cwd: root },
);
child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
