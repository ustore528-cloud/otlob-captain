import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CaptainAvailabilityStatus, MeResponse, UpdateAvailabilityResponse } from "@/services/api/dto";
import { captainService } from "@/services/api/services/captain.service";
import { queryKeys } from "@/hooks/api/query-keys";
import { useAuthStore } from "@/store/auth-store";
import type { CaptainProfile } from "@/features/auth/types";

type RollbackCtx = {
  previousMe: MeResponse | undefined;
  previousCaptain: CaptainProfile | null;
};

function applyMeAvailability(me: MeResponse, status: string, lastSeenAt?: string | null): MeResponse {
  return {
    ...me,
    captain: {
      ...me.captain,
      availabilityStatus: status,
      ...(lastSeenAt !== undefined ? { lastSeenAt } : {}),
    },
  };
}

/**
 * PATCH التوفر مع تحديث فوري (تفاؤلي)، ومزامنة مع الـ cache وZustand، وتراجع عند الفشل.
 */
export function useUpdateAvailability() {
  const queryClient = useQueryClient();

  return useMutation<UpdateAvailabilityResponse, Error, CaptainAvailabilityStatus, RollbackCtx>({
    mutationFn: (availabilityStatus: CaptainAvailabilityStatus) =>
      captainService.updateAvailability({ availabilityStatus }),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.captain.me });

      const previousMe = queryClient.getQueryData<MeResponse>(queryKeys.captain.me);
      const previousCaptain = useAuthStore.getState().captain;

      if (previousMe) {
        queryClient.setQueryData<MeResponse>(queryKeys.captain.me, applyMeAvailability(previousMe, next));
      }

      if (previousCaptain) {
        useAuthStore.setState({
          captain: { ...previousCaptain, availabilityStatus: next },
        });
      }

      return { previousMe, previousCaptain };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.previousMe !== undefined) {
        queryClient.setQueryData(queryKeys.captain.me, ctx.previousMe);
      }
      if (ctx) {
        useAuthStore.setState({ captain: ctx.previousCaptain });
      }
    },
    onSuccess: (res) => {
      queryClient.setQueryData<MeResponse>(queryKeys.captain.me, (old) => {
        if (!old) return old;
        return applyMeAvailability(old, res.captain.availabilityStatus, res.captain.lastSeenAt);
      });
      useAuthStore.setState((s) => {
        if (!s.captain) return s;
        return {
          captain: {
            ...s.captain,
            availabilityStatus: res.captain.availabilityStatus,
            lastSeenAt: res.captain.lastSeenAt,
          },
        };
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.captain.assignment });
    },
  });
}
