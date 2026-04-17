export type UpdateCaptainLocationBody = {
  latitude: number;
  longitude: number;
};

export type CaptainLocationRecordDto = {
  id: string;
  captainId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
};
