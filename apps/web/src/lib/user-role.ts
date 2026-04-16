const ar: Record<string, string> = {
  ADMIN: "مدير",
  DISPATCHER: "مشغّل",
  CAPTAIN: "كابتن",
  STORE: "متجر",
  CUSTOMER: "عميل",
};

export function userRoleLabel(role: string): string {
  return ar[role] ?? role;
}
