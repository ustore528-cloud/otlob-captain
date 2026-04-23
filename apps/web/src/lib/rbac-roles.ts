export function isDispatchRole(role?: string | null): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "COMPANY_ADMIN" ||
    role === "BRANCH_MANAGER" ||
    role === "DISPATCHER"
  );
}

export function isStoreAdminRole(role?: string | null): boolean {
  return role === "STORE_ADMIN";
}

export function isManagementAdminRole(role?: string | null): boolean {
  return role === "SUPER_ADMIN" || role === "COMPANY_ADMIN" || role === "BRANCH_MANAGER";
}

export function canListOrdersRole(role?: string | null): boolean {
  return isDispatchRole(role) || isStoreAdminRole(role);
}
