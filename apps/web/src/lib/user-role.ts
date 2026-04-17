/** تسميات أدوار حسابات المنصة — «عميل (حساب)» يميّز دور CUSTOMER عن عميل التوصيل في نموذج طلب جديد */
const ar: Record<string, string> = {
  ADMIN: "مدير",
  DISPATCHER: "مشغّل",
  CAPTAIN: "كابتن",
  STORE: "متجر",
  CUSTOMER: "عميل (حساب)",
};

export function userRoleLabel(role: string): string {
  return ar[role] ?? role;
}
