/**
 * يحمّل apps/api/.env مع override حتى لا يتجاوزها DATABASE_URL القادم من الجلسة/الأداة.
 * يستدعي CLI مباشرةً (بدون shell) لتفادي DEP0190 ولمشاكل الاقتباس على Windows.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptsDir, "..");
loadEnv({ path: path.join(apiRoot, ".env"), override: true });

const require = createRequire(import.meta.url);
/** جذر المستودع (حيث تُرفع prisma عادةً في workspaces) */
const repoRoot = path.resolve(apiRoot, "../..");
let prismaCliPath;
try {
  prismaCliPath = require.resolve("prisma/build/index.js", {
    paths: [apiRoot, repoRoot],
  });
} catch {
  console.error(
    "Could not resolve prisma CLI. Run npm install from the repo root (workspace hoists prisma to node_modules).",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const child = spawn(process.execPath, [prismaCliPath, ...args], {
  stdio: "inherit",
  cwd: apiRoot,
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
