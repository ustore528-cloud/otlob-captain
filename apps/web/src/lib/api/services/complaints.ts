import { apiFetch, paths } from "@/lib/api/http";

export type ComplaintListItem = {
  id: string;
  companyId: string;
  companyName: string;
  customerName: string;
  customerPhone: string;
  complaintType: string;
  message: string;
  status: "NEW" | "REVIEWED" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
};

export function fetchComplaints(token: string): Promise<ComplaintListItem[]> {
  return apiFetch<ComplaintListItem[]>(paths.complaints.root, { method: "GET", token });
}

export type PatchComplaintStatusBody = {
  status: ComplaintListItem["status"];
};

export function patchComplaintStatus(token: string, id: string, body: PatchComplaintStatusBody): Promise<unknown> {
  return apiFetch(paths.complaints.status(id), { method: "PATCH", body: JSON.stringify(body), token });
}
