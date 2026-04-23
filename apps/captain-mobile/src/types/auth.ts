export type UserRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "BRANCH_MANAGER"
  | "STORE_ADMIN"
  | "DISPATCHER"
  | "CAPTAIN"
  | "CUSTOMER";

export type CaptainAvailabilityStatus = "OFFLINE" | "AVAILABLE" | "BUSY" | "ON_DELIVERY";
