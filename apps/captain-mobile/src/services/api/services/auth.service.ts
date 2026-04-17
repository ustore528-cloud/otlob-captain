import { paths } from "@captain/shared";
import { rawRequest } from "../client";
import type { LoginCaptainRequest, LoginCaptainResponse, RefreshCaptainResponse } from "../dto";

export const authService = {
  login(body: LoginCaptainRequest): Promise<LoginCaptainResponse> {
    return rawRequest<LoginCaptainResponse>(paths.mobileCaptain.login, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  refresh(refreshToken: string): Promise<RefreshCaptainResponse> {
    return rawRequest<RefreshCaptainResponse>(paths.mobileCaptain.refresh, {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },
};
