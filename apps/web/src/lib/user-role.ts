/** تسميات أدوار حسابات المنصة — «عميل (حساب)» يميّز دور CUSTOMER عن عميل التوصيل في نموذج طلب جديد */
const ar: Record<string, string> = {
  SUPER_ADMIN: "مدير عام",
  COMPANY_ADMIN: "مدير شركة",
  BRANCH_MANAGER: "مدير فرع",
  STORE_ADMIN: "مسؤول متجر",
  DISPATCHER: "مشغّل",
  CAPTAIN: "كابتن",
  CUSTOMER: "عميل (حساب)",
};

export function userRoleLabel(role: string): string {
  return ar[role] ?? role;
}
