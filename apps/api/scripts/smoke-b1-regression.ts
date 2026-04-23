/**
 * End-to-end HTTP smoke: login → create order → manual assign → captain accept → status chain → delivered.
 * Prereq: `DATABASE_URL` + API at SMOKE_BASE_URL (default http://127.0.0.1:4000), seed users (+966500000002 dispatch, +966511111111 captain), seed store, seed password Admin12345!
 *
 * From apps/api:  `npx tsx scripts/smoke-b1-regression.ts`
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { OrderStatus } from "@prisma/client";

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:4000";
const DISPATCHER_PHONE = "+966500000002";
const CAPTAIN_PHONE = "+966511111111";
const PASSWORD = "Admin12345!";

async function jfetch(
  method: string,
  path: string,
  options?: { body?: object; token?: string },
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await r.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Non-JSON ${r.status} from ${path}: ${text.slice(0, 400)}`);
  }
  if (!r.ok) {
    throw new Error(`${method} ${path} -> ${r.status}: ${text.slice(0, 500)}`);
  }
  return data as { success: true; data: any };
}

async function main() {
  const health = (await (await fetch(`${BASE}/health`)).json()) as { success?: boolean };
  if (health && "success" in health && !health.success) {
    throw new Error("Health check failed");
  }
  // eslint-disable-next-line no-console
  console.log("[smoke] health OK at", BASE);

  const { data: dLogin } = await jfetch("POST", "/api/v1/auth/login", {
    body: { phone: DISPATCHER_PHONE, password: PASSWORD },
  });
  const dToken = dLogin?.accessToken as string;
  if (!dToken) throw new Error("No dispatcher accessToken");

  const captain = await prisma.captain.findFirst({
    where: { user: { phone: CAPTAIN_PHONE } },
    select: { id: true, userId: true },
  });
  if (!captain) throw new Error("Captain for smoke not found in DB (seed +966511111111)");

  const ts = Date.now();
  const { data: createRes } = await jfetch("POST", "/api/v1/orders", {
    token: dToken,
    body: {
      storeId: "seed-store-main",
      customerName: "Smoker",
      customerPhone: `+1555${(ts % 1e7).toString().padStart(7, "0")}`,
      pickupAddress: "seed pickup",
      dropoffAddress: "seed dropoff",
      area: "الرياض",
      amount: 10,
    },
  });
  const orderId = createRes?.id as string;
  if (!orderId) throw new Error("No order id from create");
  // eslint-disable-next-line no-console
  console.log("[smoke] order created", orderId);

  await jfetch("POST", `/api/v1/orders/${orderId}/distribution/manual`, {
    token: dToken,
    body: { captainId: captain.id, assignmentType: "MANUAL" },
  });
  // eslint-disable-next-line no-console
  console.log("[smoke] manual assign OK");

  const { data: cLogin } = await jfetch("POST", "/api/v1/auth/login", {
    body: { phone: CAPTAIN_PHONE, password: PASSWORD },
  });
  const cToken = cLogin?.accessToken as string;
  if (!cToken) throw new Error("No captain accessToken");

  await jfetch("POST", `/api/v1/orders/${orderId}/accept`, { token: cToken, body: {} });
  // eslint-disable-next-line no-console
  console.log("[smoke] accept OK");

  for (const st of [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT, OrderStatus.DELIVERED]) {
    await jfetch("PATCH", `/api/v1/orders/${orderId}/status`, {
      token: cToken,
      body: { status: st },
    });
  }
  // eslint-disable-next-line no-console
  console.log("[smoke] status chain OK (PICKED_UP → IN_TRANSIT → DELIVERED)");

  const { data: finalOrder } = await jfetch("GET", `/api/v1/orders/${orderId}`, { token: cToken });
  if (finalOrder?.status !== "DELIVERED") {
    throw new Error(`Expected DELIVERED, got ${String(finalOrder?.status)}`);
  }
  // eslint-disable-next-line no-console
  console.log("[smoke] PASS: full regression (login, create, assign, accept, update, deliver)");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("[smoke] FAIL", e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
