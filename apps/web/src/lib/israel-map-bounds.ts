/**
 * تقييد عرض الخرائط في الواجهة إلى إطار جغرافي يغطي إسرائيل (WGS84 + هامش بسيط).
 * يُستخدم لتثبيت الكاميرا ومنع السحب إلى «العالم كله».
 */
export const ISRAEL_MAP_BOUNDS = {
  south: 29.42,
  north: 33.52,
  west: 34.12,
  east: 35.92,
} as const;

/** [lat, lng] — وسط الدولة تقريباً */
export const ISRAEL_MAP_DEFAULT_CENTER: [number, number] = [31.46, 34.85];

export const ISRAEL_MAP_DEFAULT_ZOOM = 8;

/** زوايا Leaflet: جنوب-غرب، شمال-شرق */
export const ISRAEL_LEAFLET_MAX_BOUNDS: [[number, number], [number, number]] = [
  [ISRAEL_MAP_BOUNDS.south, ISRAEL_MAP_BOUNDS.west],
  [ISRAEL_MAP_BOUNDS.north, ISRAEL_MAP_BOUNDS.east],
];

export function clampLatLng(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.min(ISRAEL_MAP_BOUNDS.north, Math.max(ISRAEL_MAP_BOUNDS.south, lat)),
    lng: Math.min(ISRAEL_MAP_BOUNDS.east, Math.max(ISRAEL_MAP_BOUNDS.west, lng)),
  };
}

export function clampLatLngPair(pair: [number, number]): [number, number] {
  const o = clampLatLng(pair[0], pair[1]);
  return [o.lat, o.lng];
}

export function googleMapsRestrictionOption(): {
  latLngBounds: { north: number; south: number; east: number; west: number };
  strictBounds: boolean;
} {
  return {
    latLngBounds: {
      north: ISRAEL_MAP_BOUNDS.north,
      south: ISRAEL_MAP_BOUNDS.south,
      east: ISRAEL_MAP_BOUNDS.east,
      west: ISRAEL_MAP_BOUNDS.west,
    },
    strictBounds: true,
  };
}
