/**
 * Validates WhatsApp phone normalization assumptions.
 * Run from captain-mobile: `npm run verify:phone-whatsapp-normalize`
 */
import { normalizePhoneForWhatsApp } from "../src/lib/phone-whatsapp-normalize";

type Case = {
  input: string;
  expected: string | null;
};

const cases: Case[] = [
  { input: "0597347060", expected: "972597347060" },
  { input: "0526554870", expected: "972526554870" },
  { input: "0543165161", expected: "972543165161" },
  { input: "972543165161", expected: "972543165161" },
  { input: "+972543165161", expected: "972543165161" },
  { input: "9720543165161", expected: "972543165161" },
  { input: "9700597347060", expected: "970597347060" },
  { input: "+970597347060", expected: "970597347060" },
  { input: "  +970 (59)-734-7060 ", expected: "970597347060" },
  { input: " 05 431-65161 ", expected: "972543165161" },
  // Any local 05xxxxxxxx maps to 9725xxxxxxxx
  { input: "0581234567", expected: "972581234567" },
  { input: "+972 / 54-316-51-61", expected: "972543165161" },
];

for (const t of cases) {
  const got = normalizePhoneForWhatsApp(t.input);
  if (got !== t.expected) {
    throw new Error(`normalizePhoneForWhatsApp failed for "${t.input}": expected "${t.expected}", got "${got}"`);
  }
}

// eslint-disable-next-line no-console
console.info("[verify-phone-whatsapp-normalize] passed");
