import { paths } from "@captain/shared";
import { authRequest } from "../client";
import type { CaptainLocationRecordDto, UpdateCaptainLocationBody } from "../dto";

/** Captain GPS → dashboard map — POST /mobile/captain/me/location */
export const trackingService = {
  sendLocation(body: UpdateCaptainLocationBody): Promise<CaptainLocationRecordDto> {
    return authRequest<CaptainLocationRecordDto>(paths.mobileCaptain.location, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
