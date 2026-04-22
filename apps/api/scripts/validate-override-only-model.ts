import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canBypassAutomaticSingleOrderRule,
  canCaptainReceiveAutomaticOrder,
} from "../src/services/distribution/eligibility.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function validateOverrideGateBehavior(): void {
  const overrideOn = {
    manualMultiOrderOverrideEnabled: true,
    overrideSource: "DISPATCHER_OVERRIDE",
  } as const;
  const overrideOff = {
    manualMultiOrderOverrideEnabled: false,
    overrideSource: "DISPATCHER_OVERRIDE",
  } as const;
  const invalidOverride = {
    manualMultiOrderOverrideEnabled: true,
    overrideSource: "   ",
  } as const;

  assert(
    canBypassAutomaticSingleOrderRule(overrideOn) === true,
    "Override gate should pass only when explicit enablement + non-empty source are present.",
  );
  assert(
    canBypassAutomaticSingleOrderRule(overrideOff) === false,
    "Override gate should fail when manual multi-order mode is OFF.",
  );
  assert(
    canBypassAutomaticSingleOrderRule(invalidOverride) === false,
    "Override gate should fail when source is missing/blank.",
  );
  // eslint-disable-next-line no-console
  console.info("[validate-override-only-model] override gate assertions passed");
}

function validateAutomaticCapacityByPolicy(): void {
  assert(
    canCaptainReceiveAutomaticOrder(1, "OVERRIDE_MULTI_ORDER") === true,
    "When explicit override mode is ON, one active order may still allow another automatic offer.",
  );
  assert(
    canCaptainReceiveAutomaticOrder(2, "OVERRIDE_MULTI_ORDER") === false,
    "Even in override mode, automatic capacity must stop at configured override limit.",
  );
  assert(
    canCaptainReceiveAutomaticOrder(1, "DEFAULT_SINGLE_ORDER") === false,
    "When override mode is OFF, default automatic model must block second active order.",
  );
  // eslint-disable-next-line no-console
  console.info("[validate-override-only-model] policy capacity assertions passed");
}

function validateIsolationInEngine(): void {
  const enginePath = resolve(process.cwd(), "src/services/distribution/distribution-engine.ts");
  const source = readFileSync(enginePath, "utf8");

  assert(
    source.includes('if (overrideGate && !canBypassAutomaticSingleOrderRule(overrideGate))'),
    "Engine must hard-reject invalid override gate instead of silently falling back.",
  );
  assert(
    source.includes('const policy: AutoDistributionPolicy = overrideGate') &&
      source.includes('"OVERRIDE_MULTI_ORDER"') &&
      source.includes('"DEFAULT_SINGLE_ORDER"'),
    "Engine must choose override policy only when overrideGate exists.",
  );
  assert(
    source.includes("assignmentType: Extract<AssignmentType, \"MANUAL\" | \"DRAG_DROP\">"),
    "Manual drag/drop assignment path must remain explicitly supported as an exception flow.",
  );
  assert(
    source.includes("distributionMode: DistributionMode.MANUAL"),
    "Manual override assignment must be isolated from automatic distribution mode.",
  );

  // eslint-disable-next-line no-console
  console.info("[validate-override-only-model] engine isolation assertions passed");
}

validateOverrideGateBehavior();
validateAutomaticCapacityByPolicy();
validateIsolationInEngine();
// eslint-disable-next-line no-console
console.info("[validate-override-only-model] all checks passed");
