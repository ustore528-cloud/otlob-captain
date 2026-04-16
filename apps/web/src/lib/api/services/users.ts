import { apiFetch, paths } from "@/lib/api/http";
import type { Paginated, UserListItem } from "@/types/api";

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
