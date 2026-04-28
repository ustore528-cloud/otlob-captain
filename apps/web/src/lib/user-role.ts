import i18n from "@/i18n/i18n";

/** Platform account role labels for UI (server enum unchanged). */
export function userRoleLabel(role: string): string {
  const key = `roles.${role}`;
  return i18n.exists(key) ? String(i18n.t(key)) : role;
}
