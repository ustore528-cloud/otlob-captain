/**
 * Phase 5 — verifies persisted picked_up_at / delivered_at via ordersService.updateStatus
 * and that a later row update does not change delivered_at.
 *
 * Run from `apps/api`: `npm run verify:order-pickup-delivery-timestamps`
 *
 * Requires DATABASE_URL. Temporarily sets the chosen captain's commissionPercent to 0
 * so DELIVERED does not require prepaid/ledger commission side effects; restores on exit.
 */
import "dotenv/config";
import { OrderStatus, Prisma, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { patchOrderStatusTransitionTimestamps } from "../src/domain/order-status-timestamps.js";
import { ordersService } from "../src/services/orders.service.js";
import { reportsService } from "../src/services/reports.service.js";
import { generateOrderNumber } from "../src/utils/order-number.js";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const captain = await prisma.captain.findFirst({
    where: { isActive: true },
    include: { user: { select: { id: true } } },
  });
  if (!captain?.user) throw new Error("No active captain with user");
  const branch = await prisma.branch.findFirst({
    where: { id: captain.branchId, isActive: true },
  });
  if (!branch) throw new Error("Captain branch not found");
  const store = await prisma.store.findFirst({
    where: { companyId: captain.companyId, branchId: captain.branchId },
  });
  if (!store) throw new Error("No store in captain branch");

  const captainIdForRestore = captain.id;
  const commissionPercentToRestore = captain.commissionPercent;

  await prisma.captain.update({
    where: { id: captain.id },
    data: { commissionPercent: new Prisma.Decimal(0) },
  });

  const tPick = new Date("2025-06-01T12:00:00.000Z");
  const once = patchOrderStatusTransitionTimestamps({ pickedUpAt: null, deliveredAt: null }, OrderStatus.PICKED_UP, tPick);
  assert(Object.keys(once).length === 1 && once.pickedUpAt === tPick, "domain: first PICKED_UP sets pickedUpAt only");
  const noOverwrite = patchOrderStatusTransitionTimestamps(
    { pickedUpAt: tPick, deliveredAt: null },
    OrderStatus.PICKED_UP,
    new Date("2099-01-01T00:00:00.000Z"),
  );
  assert(Object.keys(noOverwrite).length === 0, "domain: second PICKED_UP must not patch timestamps");
  const tDel = new Date("2025-06-02T00:00:00.000Z");
  const delOnce = patchOrderStatusTransitionTimestamps({ pickedUpAt: tPick, deliveredAt: null }, OrderStatus.DELIVERED, tDel);
  assert(delOnce.deliveredAt === tDel && Object.keys(delOnce).length === 1, "domain: first DELIVERED sets deliveredAt");
  const delNoOverwrite = patchOrderStatusTransitionTimestamps(
    { pickedUpAt: tPick, deliveredAt: tDel },
    OrderStatus.DELIVERED,
    new Date("2099-01-01T00:00:00.000Z"),
  );
  assert(Object.keys(delNoOverwrite).length === 0, "domain: second DELIVERED must not patch deliveredAt");

  try {
    const orderNumber = generateOrderNumber();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName: "Ts verify",
        customerPhone: "+966500000088",
        companyId: branch.companyId,
        branchId: branch.id,
        storeId: store.id,
        pickupAddress: "P",
        dropoffAddress: "D",
        area: "Riyadh",
        amount: new Prisma.Decimal("40.00"),
        cashCollection: new Prisma.Decimal("40.00"),
        deliveryFee: new Prisma.Decimal("0"),
        status: OrderStatus.ACCEPTED,
        assignedCaptainId: captain.id,
      },
    });

    try {
      const fresh = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { pickedUpAt: true, deliveredAt: true },
      });
      assert(fresh.pickedUpAt == null && fresh.deliveredAt == null, "Expected null timestamps before PICKED_UP");

      const actor = {
        userId: captain.user.id,
        role: UserRole.CAPTAIN,
        storeId: null as string | null,
        companyId: captain.companyId,
        branchId: captain.branchId,
      };

      await ordersService.updateStatus(order.id, OrderStatus.PICKED_UP, actor);
      const afterPickup = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { pickedUpAt: true, deliveredAt: true, updatedAt: true },
      });
      assert(afterPickup.pickedUpAt != null, "picked_up_at must be set after PICKED_UP");
      assert(afterPickup.deliveredAt == null, "delivered_at must stay null after PICKED_UP");

      await ordersService.updateStatus(order.id, OrderStatus.IN_TRANSIT, actor);
      await ordersService.updateStatus(order.id, OrderStatus.DELIVERED, actor);

      const afterDeliver = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { pickedUpAt: true, deliveredAt: true, updatedAt: true },
      });
      assert(afterDeliver.deliveredAt != null, "delivered_at must be set after DELIVERED");
      assert(
        afterDeliver.pickedUpAt?.getTime() === afterPickup.pickedUpAt?.getTime(),
        "picked_up_at must not change after further transitions",
      );

      const deliveredAtIso = afterDeliver.deliveredAt!.toISOString();

      await prisma.order.update({
        where: { id: order.id },
        data: { notes: "verify-order-pickup-delivery-timestamps touch" },
      });

      const afterTouch = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        select: { deliveredAt: true, updatedAt: true },
      });
      assert(
        afterTouch.deliveredAt!.toISOString() === deliveredAtIso,
        "delivered_at must survive unrelated order row update (updated_at may move)",
      );
      assert(
        afterTouch.updatedAt.getTime() > afterDeliver.updatedAt.getTime(),
        "expected updatedAt to move after touch",
      );

      const admin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
      if (admin) {
        const from = new Date(Date.now() - 86_400_000).toISOString();
        const to = new Date(Date.now() + 60_000).toISOString();
        const page = await reportsService.listOrdersHistory(
          { userId: admin.id, role: UserRole.SUPER_ADMIN, companyId: null, branchId: null },
          { from, to, page: 1, pageSize: 100 },
        );
        const row = page.rows.find((r) => r.orderNumber === orderNumber);
        assert(row, "orders-history row not found for test order");
        assert(row.pickupAt === afterPickup.pickedUpAt!.toISOString(), "reports pickupAt must match picked_up_at");
        assert(row.deliveredAt === deliveredAtIso, "reports deliveredAt must match delivered_at");
      } else {
        // eslint-disable-next-line no-console
        console.warn("[verify-order-pickup-delivery-timestamps] skip reportsService check: no SUPER_ADMIN user");
      }

      // eslint-disable-next-line no-console
      console.info("[verify-order-pickup-delivery-timestamps] passed (orderNumber=%s)", orderNumber);
    } finally {
      await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    }
  } finally {
    await prisma.captain.update({
      where: { id: captainIdForRestore },
      data: { commissionPercent: commissionPercentToRestore },
    });
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
