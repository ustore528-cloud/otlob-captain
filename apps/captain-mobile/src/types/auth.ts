export type UserRole =
  | "SUPER_ADMIN"
  | "COMPANY_ADMIN"
  | "BRANCH_MANAGER"
  | "CAPTAIN_SUPERVISOR"
  | "STORE_ADMIN"
  | "STORE_USER"
  | "DISPATCHER"
  | "CAPTAIN"
  | "CUSTOMER";

export type CaptainAvailabilityStatus = "OFFLINE" | "AVAILABLE" | "BUSY" | "ON_DELIVERY";
