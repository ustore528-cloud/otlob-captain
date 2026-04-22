import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { canCaptainReceiveAutomaticOrder } from "../src/services/distribution/eligibility.js";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runEligibilityAssertions(): void {
  assert(
    canCaptainReceiveAutomaticOrder(0, "DEFAULT_SINGLE_ORDER") === true,
    "Captain with 0 active working orders must be eligible for automatic assignment.",
  );
  assert(
    canCaptainReceiveAutomaticOrder(1, "DEFAULT_SINGLE_ORDER") === false,
    "Captain with 1 active working order must be blocked from another automatic assignment.",
  );
  assert(
    canCaptainReceiveAutomaticOrder(0, "DEFAULT_SINGLE_ORDER") === true,
    "Captain must become eligible again after active working orders return to 0.",
  );
  // eslint-disable-next-line no-console
  console.info("[validate-default-auto-single-order] eligibility assertions passed");
}

function runFlowCallsiteAssertions(): void {
  const enginePath = resolve(process.cwd(), "src/services/distribution/distribution-engine.ts");
  const source = readFileSync(enginePath, "utf8");

  assert(
    source.includes("this.offerNextAutoCaptainTx(tx, order.id, null);"),
    "Timeout fallback must call offerNextAutoCaptainTx with default single-order path.",
  );
  assert(
    source.includes("this.offerNextAutoCaptainTx(tx, orderId, actorUserId);"),
    "Reject/start-auto paths must call offerNextAutoCaptainTx with default single-order path.",
  );
  assert(
    source.includes("this.offerNextAutoCaptainTx(tx, orderId, actorUserId, undefined, ctx.requestId);"),
    "Resend path must call offerNextAutoCaptainTx without override gate.",
  );
  assert(
    !source.includes("offerNextAutoCaptainTx(tx, orderId, actorUserId, {"),
    "Default automatic flows must not inject override gate object implicitly.",
  );

  // eslint-disable-next-line no-console
  console.info("[validate-default-auto-single-order] auto-flow callsite assertions passed");
}

runEligibilityAssertions();
runFlowCallsiteAssertions();
// eslint-disable-next-line no-console
console.info("[validate-default-auto-single-order] all checks passed");
