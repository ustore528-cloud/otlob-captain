import { apiFetch, paths } from "@/lib/api/http";
import type { SupervisorCaptainTransferResultDto } from "@/types/api";

export function transferSupervisorToCaptain(
  token: string,
  input: { captainId: string; amount: string; idempotencyKey: string },
): Promise<SupervisorCaptainTransferResultDto> {
  return apiFetch<SupervisorCaptainTransferResultDto>(paths.supervisorWallets.transferToCaptain, {
    method: "POST",
    token,
    body: JSON.stringify({ captainId: input.captainId, amount: input.amount }),
    idempotencyKey: input.idempotencyKey,
  });
}
