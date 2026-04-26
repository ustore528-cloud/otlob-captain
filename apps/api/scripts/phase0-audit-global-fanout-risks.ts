/**
 * Phase 0 (read-only/static): detect risky global fanout patterns in notification/realtime paths.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");

type Risk = {
  id: string;
  severity: "HIGH" | "MEDIUM";
  file: string;
  rule: string;
  evidence: string;
};

async function scanFile(relPath: string): Promise<string> {
  return readFile(path.resolve(apiRoot, relPath), "utf8");
}

async function main() {
  const risks: Risk[] = [];

  const notificationsSvcPath = "src/services/notifications.service.ts";
  const notificationsSvc = await scanFile(notificationsSvcPath);
  const hasLegacyGlobalPattern =
    notificationsSvc.includes("sendQuickStatusAlert") &&
    notificationsSvc.includes("prisma.captain.findMany") &&
    notificationsSvc.includes("where: { isActive: true, user: { isActive: true } }");
  const hasTenantScopeGuard =
    notificationsSvc.includes("TENANT_SCOPE_REQUIRED") &&
    notificationsSvc.includes("isSuperAdminRole") &&
    notificationsSvc.includes("globalRequested");
  if (hasLegacyGlobalPattern || !hasTenantScopeGuard) {
    risks.push({
      id: "global_quick_status_captain_fanout",
      severity: "HIGH",
      file: notificationsSvcPath,
      rule: "Quick status alert must be tenant-scoped (company/branch for non-super-admin).",
      evidence: hasLegacyGlobalPattern
        ? "sendQuickStatusAlert selects all active captains without companyId/branchId filter."
        : "sendQuickStatusAlert is missing explicit non-super-admin tenant scope guard.",
    });
  }

  const notificationsControllerPath = "src/controllers/notifications.controller.ts";
  const notificationsController = await scanFile(notificationsControllerPath);
  if (
    notificationsController.includes("quickStatusAlert") &&
    (!notificationsController.includes("companyId: req.user!.companyId") ||
      !notificationsController.includes("role: req.user!.role"))
  ) {
    risks.push({
      id: "quick_status_controller_no_scope_context",
      severity: "MEDIUM",
      file: notificationsControllerPath,
      rule: "Controller should pass actor tenant context when broadcast behavior is tenant-bound.",
      evidence: "quickStatusAlert does not pass authenticated role+company tenant context.",
    });
  }

  const hubPath = "src/realtime/hub.ts";
  const hub = await scanFile(hubPath);
  if (hub.includes("emitToCaptain(") && !hub.includes("companyId")) {
    risks.push({
      id: "captain_direct_emit_unscoped_room",
      severity: "MEDIUM",
      file: hubPath,
      rule: "Direct captain emit should rely on prior tenant-safe captain selection.",
      evidence: "emitToCaptain emits by user room id without tenant guard in hub layer.",
    });
  }

  const socketServerPath = "src/realtime/socket-server.ts";
  const socketServer = await scanFile(socketServerPath);
  if (
    socketServer.includes("dispatchersCompany") &&
    socketServer.includes("dispatchersBranch") &&
    !socketServer.includes("requiresCompanyScopeForRealtime") &&
    !socketServer.includes("canActorJoinCompanyRoom")
  ) {
    risks.push({
      id: "socket_dispatcher_room_depends_on_company_claim_resolution",
      severity: "MEDIUM",
      file: socketServerPath,
      rule: "Socket tenant room join safety depends on authenticated/normalized company scope.",
      evidence: "Socket room join path is missing explicit company-scope enforcement helper.",
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    scannedFiles: [notificationsSvcPath, notificationsControllerPath, hubPath, socketServerPath],
    riskCount: risks.length,
    risks,
  };

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
