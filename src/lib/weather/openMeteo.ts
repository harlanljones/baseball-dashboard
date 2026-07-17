import { TTL } from "@/lib/mlb/client";

/**
 * A single hourly forecast point from Open-Meteo API.
 * All timestamps are in the timezone of the queried location.
 */
export interface HourlyForecastPoint {
  timeISO: string;
  tempF: number;
  humidityPct: number;
  windSpeedMph: number;
  windGustMph: number;
  windDirectionDeg: number;
  cloudCoverPct: number;
  precipProbabilityPct: number;
  weatherCode: number;
}

/**
 * Fetch hourly weather forecast from Open-Meteo API.
 *
 * @param lat      Latitude of the location
 * @param lon      Longitude of the location
 * @param dateISO  Date in YYYY-MM-DD format (game's local date)
 * @returns Object containing elevation in feet and array of hourly forecast points
 * @throws Error if the API returns non-2xx status
 */
export async function fetchHourlyForecast(
  lat: number,
  lon: number,
  dateISO: string,
): Promise<{ elevationFt: number; hours: HourlyForecastPoint[] }> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");

  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("start_date", dateISO);
  url.searchParams.set("end_date", dateISO);
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation_probability,weather_code",
  );

  const res = await fetch(url.toString(), {
    next: { revalidate: TTL.weather, tags: ["weather"] },
  });

  if (!res.ok) {
    throw new Error(
      `Open-Meteo API request failed (${res.status}) for ${url.toString()}`,
    );
  }

  const data = (await res.json()) as RawOpenMeteoResponse;

  // Convert elevation from meters to feet (1 meter = 3.28084 feet)
  const elevationFt = Math.round((data.elevation ?? 0) * 3.28084);

  // Zip parallel arrays into HourlyForecastPoint objects
  const hours = data.hourly.time.map((timeISO: string, idx: number) => ({
    timeISO,
    tempF: data.hourly.temperature_2m[idx],
    humidityPct: data.hourly.relative_humidity_2m[idx],
    windSpeedMph: data.hourly.wind_speed_10m[idx],
    windGustMph: data.hourly.wind_gusts_10m[idx],
    windDirectionDeg: data.hourly.wind_direction_10m[idx],
    cloudCoverPct: data.hourly.cloud_cover[idx],
    precipProbabilityPct: data.hourly.precipitation_probability[idx],
    weatherCode: data.hourly.weather_code[idx],
  })) as HourlyForecastPoint[];

  return { elevationFt, hours };
}

// --- Raw API response shape (only fields we read) ---

interface RawOpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  cloud_cover: number[];
  precipitation_probability: number[];
  weather_code: number[];
}

interface RawOpenMeteoResponse {
  elevation?: number;
  hourly: RawOpenMeteoHourly;
}
