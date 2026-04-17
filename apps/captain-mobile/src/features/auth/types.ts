import type { CaptainProfileDto, SessionUserDto } from "@/services/api/dto";

export type { LoginCaptainResponse, MeResponse, RefreshCaptainResponse } from "@/services/api/dto";

export type SessionUser = SessionUserDto;
export type CaptainProfile = CaptainProfileDto;

export type SessionSnapshot = {
  user: SessionUser;
  captain: CaptainProfile;
};
