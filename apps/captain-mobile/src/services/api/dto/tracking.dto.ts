export type UpdateCaptainLocationBody = {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  timestamp?: string | null;
};

export type CaptainLocationRecordDto = {
  id: string;
  captainId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
};
