export type Sky =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "thunderstorm"
  | "snow"
  | "unknown";

export type RoofType = "open" | "retractable" | "dome";

export interface Ballpark {
  name: string;
  lat: number;
  lon: number;
  /** Compass bearing (0-360, 0=N, 90=E) from home plate toward straightaway CF. */
  cfBearingDeg: number;
  roof: RoofType;
  elevationFt: number;
}

export type WindCategory = "out" | "in" | "cross-l-to-r" | "cross-r-to-l" | "calm";

export interface WindRelative {
  /** 0 = blowing straight out to CF, ±180 = blowing straight in. Also the SVG arrow rotation. */
  plateRelativeDeg: number;
  category: WindCategory;
  /** e.g. "Out to left-center", "In from right field", "Crosswind, left to right". */
  label: string;
  speedMph: number;
  gustMph?: number;
}

export interface WeatherHour {
  timeISO: string;
  tempF: number;
  humidityPct: number;
  sky: Sky;
  skyLabel: string;
  cloudCoverPct: number;
  precipProbabilityPct: number;
  wind: WindRelative;
}

export interface GameWeather {
  ballpark: Ballpark | null;
  elevationFt: number | null;
  roof: RoofType | null;
  /** ~4 hourly buckets spanning first pitch through +3h. Empty if forecast unavailable. */
  hours: WeatherHour[];
  /** hours[0], convenience for "gametime" tiles. */
  gametime: WeatherHour | null;
  tempRangeF: { min: number; max: number } | null;
  humidityPct: number | null;
  /** MLB's own observed snapshot (live/started games only). */
  observed: { condition?: string; tempF?: number; windText?: string } | null;
}
