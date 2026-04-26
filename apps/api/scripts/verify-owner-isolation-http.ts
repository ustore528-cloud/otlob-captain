/**
 * Spawns API, runs HTTP checks for Ahmad/Mahmoud isolation + public routes.
 * Run from repo: npx tsx apps/api/scripts/verify-owner-isolation-http.ts
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || process.env.VERIFY_API_PORT || 4011);
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

const AHMAD_PHONE = "+966501110001";
const MAHMOUD_PHONE = "+966501110002";
const PASS = "VerifyIso123!";

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; error: { code: string; message: string } };

async function j<T>(r: Response): Promise<T> {
  return r.json() as Promise<T>;
}

async function waitForApi(maxMs = 45000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/public/request-context/CA-AHMAD`);
      if (r.status === 200 || r.status === 404) return;
    } catch {
      /* not up */
    }
    await delay(400);
  }
  throw new Error("API did not become ready in time");
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const child = spawn("node", ["dist/server.js"], {
    cwd: apiRoot,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr?.on("data", (c: Buffer) => {
    stderr += c.toString();
  });
  child.on("error", (e) => {
    throw e;
  });

  try {
    await waitForApi();

    const ctxA = (await j<ApiOk<{ zones: { id: string; name: string }[]; company: { name: string } }>>(
      await fetch(`${BASE}/public/request-context/CA-AHMAD`),
    )) as ApiOk<{ zones: { id: string; name: string }[]; company: { name: string } }>;
    assert(ctxA.success, "ctxA success");
    assert(ctxA.data.company.name.includes("Ahmad"), "Ahmad context company name");

    const ctxB = (await j<ApiOk<{ zones: { id: string; name: string }[]; company: { name: string } }>>(
      await fetch(`${BASE}/public/request-context/CA-MAHMOUD`),
    )) as ApiOk<{ zones: { id: string; name: string }[]; company: { name: string } }>;
    assert(ctxB.success, "ctxB success");
    assert(ctxB.data.company.name.includes("Mahmoud"), "Mahmoud context company name");

    const bad = (await j<ApiErr>(await fetch(`${BASE}/public/request-context/INVALID-CODE-999`))) as ApiErr;
    assert(!bad.success && bad.error.code === "PUBLIC_OWNER_NOT_FOUND", "invalid owner code");

    const zoneA = ctxA.data.zones.find((z) => z.name === "القدس")?.id;
    const zoneB = ctxB.data.zones.find((z) => z.name === "القدس")?.id;
    assert(zoneA && zoneB, "zones القدس in both contexts");

    const orderPayload = (ownerCode: string, zoneId: string, phone: string) => ({
      ownerCode,
      customerName: "عميل عام",
      customerPhone: phone,
      pickupAddress: "من هنا",
      dropoffAddress: "إلى هناك",
      area: "القدس",
      amount: 25,
      zoneId,
      ownerUserId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      companyId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
    });

    const createA = (await j<ApiOk<{ id: string; ownerUserId: string | null; orderPublicOwnerCode: string | null; zoneId: string | null }>>(
      await fetch(`${BASE}/public/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload("CA-AHMAD", zoneA, "+966509990001")),
      }),
    )) as ApiOk<{ id: string; ownerUserId: string | null; orderPublicOwnerCode: string | null; zoneId: string | null }>;
    assert(createA.success, "create order A");
    assert(createA.data.orderPublicOwnerCode === "CA-AHMAD", "order A snapshot code");
    assert(createA.data.zoneId === zoneA, "order A zone");
    assert(createA.data.ownerUserId, "order A ownerUserId");

    const createB = (await j<ApiOk<{ id: string; ownerUserId: string | null; orderPublicOwnerCode: string | null; zoneId: string | null }>>(
      await fetch(`${BASE}/public/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload("CA-MAHMOUD", zoneB, "+966509990002")),
      }),
    )) as ApiOk<{ id: string; ownerUserId: string | null; orderPublicOwnerCode: string | null; zoneId: string | null }>;
    assert(createB.success, "create order B");
    assert(createB.data.ownerUserId !== createA.data.ownerUserId, "different owners");

    async function login(phone: string): Promise<string> {
      const r = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password: PASS }),
      });
      const body = (await j<ApiOk<{ accessToken: string }>>(r)) as ApiOk<{ accessToken: string }>;
      assert(body.success, `login ${phone}`);
      return body.data.accessToken;
    }

    const tokenA = await login(AHMAD_PHONE);
    const tokenB = await login(MAHMOUD_PHONE);

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const capB = await prisma.captain.findFirstOrThrow({
      where: { user: { phone: "+966501110012" } },
      select: { id: true },
    });
    const capA = await prisma.captain.findFirstOrThrow({
      where: { user: { phone: "+966501110011" } },
      select: { id: true },
    });
    await prisma.$disconnect();

    const authHdr = (t: string) => ({ Authorization: `Bearer ${t}`, "Content-Type": "application/json" });

    const checks: { name: string; status: number }[] = [];

    const rCapCross = await fetch(`${BASE}/captains/${capB.id}`, { headers: authHdr(tokenA) });
    checks.push({ name: "A reads captain B", status: rCapCross.status });

    const rChargeCross = await fetch(`${BASE}/captains/${capB.id}/prepaid-charge`, {
      method: "POST",
      headers: authHdr(tokenA),
      body: JSON.stringify({ amount: 5, note: "x" }),
    });
    checks.push({ name: "A charges captain B", status: rChargeCross.status });

    const rOrderCross = await fetch(`${BASE}/orders/${createB.data.id}`, { headers: authHdr(tokenA) });
    checks.push({ name: "A reads order B", status: rOrderCross.status });

    const rAssignCross = await fetch(`${BASE}/orders/${createA.data.id}/distribution/manual`, {
      method: "POST",
      headers: authHdr(tokenA),
      body: JSON.stringify({ captainId: capB.id }),
    });
    checks.push({ name: "A assigns order A to captain B", status: rAssignCross.status });

    const rCapCross2 = await fetch(`${BASE}/captains/${capA.id}`, { headers: authHdr(tokenB) });
    checks.push({ name: "B reads captain A", status: rCapCross2.status });

    const rChargeCross2 = await fetch(`${BASE}/captains/${capA.id}/prepaid-charge`, {
      method: "POST",
      headers: authHdr(tokenB),
      body: JSON.stringify({ amount: 5, note: "x" }),
    });
    checks.push({ name: "B charges captain A", status: rChargeCross2.status });

    const rOrderCross2 = await fetch(`${BASE}/orders/${createA.data.id}`, { headers: authHdr(tokenB) });
    checks.push({ name: "B reads order A", status: rOrderCross2.status });

    const rAssignCross2 = await fetch(`${BASE}/orders/${createB.data.id}/distribution/manual`, {
      method: "POST",
      headers: authHdr(tokenB),
      body: JSON.stringify({ captainId: capA.id }),
    });
    checks.push({ name: "B assigns order B to captain A", status: rAssignCross2.status });

    for (const c of checks) {
      assert(
        c.status === 403 || c.status === 404,
        `Expected 403/404 for ${c.name}, got ${c.status}`,
      );
    }

    const listA = (await j<ApiOk<{ items: unknown[] }>>(
      await fetch(`${BASE}/captains?page=1&pageSize=100`, { headers: authHdr(tokenA) }),
    )) as ApiOk<{ items: unknown[] }>;
    assert(listA.success, "list captains A");
    assert(listA.data.items.length === 1, "A sees exactly one captain");

    const ordersA = (await j<ApiOk<{ items: { id: string }[] }>>(
      await fetch(`${BASE}/orders?page=1&pageSize=100`, { headers: authHdr(tokenA) }),
    )) as ApiOk<{ items: { id: string }[] }>;
    assert(ordersA.success, "list orders A");
    const orderIdsA = new Set(ordersA.data.items.map((o) => o.id));
    assert(orderIdsA.has(createA.data.id) && !orderIdsA.has(createB.data.id), "A orders scope");

    console.log(
      JSON.stringify(
        {
          ok: true,
          publicContexts: { ahmadCompany: ctxA.data.company.name, mahmoudCompany: ctxB.data.company.name },
          orders: { orderA: createA.data.id, orderB: createB.data.id },
          isolationHttp: checks,
          listCaptainsCountA: listA.data.items.length,
        },
        null,
        2,
      ),
    );
  } finally {
    child.kill("SIGTERM");
    await delay(500);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
