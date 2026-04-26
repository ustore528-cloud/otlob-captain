/** تسميات أدوار حسابات المنصة — «عميل (حساب)» يميّز دور CUSTOMER عن عميل التوصيل في نموذج طلب جديد */
const ar: Record<string, string> = {
  SUPER_ADMIN: "مدير المنصة",
  COMPANY_ADMIN: "مدير الشركة",
  BRANCH_MANAGER: "مدير فرع (مُعطّل)",
  CAPTAIN_SUPERVISOR: "مشرف كباتن (مُعطّل)",
  STORE_ADMIN: "موظف متجر (مُعطّل)",
  STORE_USER: "موظف متجر (مُعطّل)",
  DISPATCHER: "موظف توزيع (مُعطّل)",
  CAPTAIN: "كابتن",
  CUSTOMER: "عميل (مُعطّل)",
};

export function userRoleLabel(role: string): string {
  return ar[role] ?? role;
}
