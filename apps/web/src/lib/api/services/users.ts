import { apiFetch, paths } from "@/lib/api/http";
import type { Paginated, UserListItem } from "@/types/api";

export type CreateUserPayload = {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  role: string;
};

export type UsersListQuery = {
  page?: number;
  pageSize?: number;
  role?: string;
};

export function listUsers(token: string, q: UsersListQuery = {}): Promise<Paginated<UserListItem>> {
  const p = new URLSearchParams();
  p.set("page", String(q.page ?? 1));
  p.set("pageSize", String(q.pageSize ?? 40));
  if (q.role) p.set("role", q.role);
  return apiFetch<Paginated<UserListItem>>(`${paths.users.root}?${p.toString()}`, { token });
}

export function setUserActive(token: string, id: string, isActive: boolean) {
  return apiFetch<UserListItem>(paths.users.active(id), {
    method: "PATCH",
    token,
    body: JSON.stringify({ isActive }),
  });
}

export function createUser(token: string, body: CreateUserPayload): Promise<UserListItem> {
  return apiFetch<UserListItem>(paths.users.root, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export type UpdateCustomerProfilePayload = {
  customerPickupAddress?: string | null;
  customerDropoffAddress?: string | null;
  customerLocationLink?: string | null;
  customerArea?: string | null;
  customerDropoffLat?: number | null;
  customerDropoffLng?: number | null;
  customerPreferredAmount?: number | null;
  customerPreferredDelivery?: number | null;
};

export function updateUserCustomerProfile(token: string, id: string, body: UpdateCustomerProfilePayload) {
  return apiFetch<UserListItem>(paths.users.customerProfile(id), {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}
