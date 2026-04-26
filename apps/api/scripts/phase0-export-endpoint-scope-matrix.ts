/**
 * Phase 0: export API endpoint-scope matrix from route files (static/read-only analysis).
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const routesRoot = path.resolve(apiRoot, "src", "routes", "v1");
const outputPath = path.resolve(apiRoot, "..", "..", "docs", "tenant-phase0-endpoint-scope-matrix.md");

type Row = {
  file: string;
  method: string;
  path: string;
  auth: "yes" | "no";
  roleGuard: string;
  tenantScopeStatus: "explicit_service_scope" | "role_only_needs_review";
};

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else if (e.isFile() && e.name.endsWith(".routes.ts")) files.push(full);
  }
  return files;
}

function extractRows(fileRel: string, source: string): Row[] {
  const rows: Row[] = [];
  const auth = source.includes("router.use(authMiddleware)") || source.includes("Routes.use(authMiddleware)");
  const regex = /router\.(get|post|patch|put|delete)\(\s*["'`]([^"'`]+)["'`]([\s\S]*?)\);/g;
  let m: RegExpExecArray | null = regex.exec(source);
  while (m) {
    const method = m[1]?.toUpperCase() ?? "UNKNOWN";
    const routePath = m[2] ?? "";
    const body = m[3] ?? "";
    const roleGuardMatch = body.match(/requireRoles\(([\s\S]*?)\)/);
    const roleGuard = roleGuardMatch ? roleGuardMatch[1].replace(/\s+/g, " ").trim() : "(none)";
    const tenantScopeStatus =
      /controller/i.test(body) &&
      (fileRel.includes("orders.routes.ts") ||
        fileRel.includes("captains.routes.ts") ||
        fileRel.includes("tracking.routes.ts") ||
        fileRel.includes("reports.routes.ts") ||
        fileRel.includes("wallet-read.routes.ts") ||
        fileRel.includes("branches.routes.ts") ||
        fileRel.includes("zones.routes.ts"))
        ? "explicit_service_scope"
        : "role_only_needs_review";
    rows.push({
      file: fileRel,
      method,
      path: routePath,
      auth: auth ? "yes" : "no",
      roleGuard,
      tenantScopeStatus,
    });
    m = regex.exec(source);
  }
  return rows;
}

async function main() {
  const routeFiles = await walk(routesRoot);
  const allRows: Row[] = [];
  for (const file of routeFiles) {
    const src = await readFile(file, "utf8");
    const rel = path.relative(apiRoot, file).replace(/\\/g, "/");
    allRows.push(...extractRows(rel, src));
  }

  allRows.sort((a, b) => `${a.file}:${a.path}:${a.method}`.localeCompare(`${b.file}:${b.path}:${b.method}`));

  const lines: string[] = [];
  lines.push("# Tenant Phase 0 Endpoint Scope Matrix");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("| Route File | Method | Path | authMiddleware | requireRoles | Scope Status |");
  lines.push("|---|---|---|---|---|---|");
  for (const row of allRows) {
    lines.push(
      `| \`${row.file}\` | \`${row.method}\` | \`${row.path}\` | \`${row.auth}\` | \`${row.roleGuard}\` | \`${row.tenantScopeStatus}\` |`,
    );
  }
  lines.push("");
  lines.push("## Notes");
  lines.push("- `explicit_service_scope`: route family already maps to service-layer tenant scope checks and was prioritized in Phase 0 audit.");
  lines.push("- `role_only_needs_review`: role gating exists, but endpoint still requires manual tenant-scope verification in next pass.");

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, lines.join("\n"), "utf8");

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        outputPath,
        routeFiles: routeFiles.length,
        endpoints: allRows.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
