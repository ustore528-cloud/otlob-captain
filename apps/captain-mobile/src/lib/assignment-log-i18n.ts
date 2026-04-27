import type { TFunction } from "i18next";

const RESPONSE_KEY: Record<string, string> = {
  PENDING: "assignmentLog.responsePENDING",
  ACCEPTED: "assignmentLog.responseACCEPTED",
  REJECTED: "assignmentLog.responseREJECTED",
  EXPIRED: "assignmentLog.responseEXPIRED",
  CANCELLED: "assignmentLog.responseCANCELLED",
};

export function assignmentResponseLabel(s: string, t: TFunction): string {
  const key = RESPONSE_KEY[s];
  if (key) return t(key);
  return t("assignmentLog.unknownResponse", { code: s });
}
