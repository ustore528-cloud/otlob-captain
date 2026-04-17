import type { CaptainProfileDto } from "./captain.dto";

/** POST /mobile/captain/auth/login */
export type LoginCaptainRequest = {
  phone?: string;
  email?: string;
  password: string;
};

export type LoginCaptainResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
  user: {
    id: string;
    fullName: string;
    phone: string;
    role: string;
  };
  captain: CaptainProfileDto;
};

/** POST /mobile/captain/auth/refresh */
export type RefreshCaptainResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
};
