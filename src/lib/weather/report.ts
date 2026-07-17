import { shiftDate } from "@/lib/mlb/client";
import { getBallpark } from "./ballparks";
import type { GameWeather, WeatherHour } from "./types";
import type { HourlyForecastPoint } from "./openMeteo";
import { windRelativeToPlate, weatherCodeToSky } from "./wind";
import { fetchHourlyForecast } from "./openMeteo";

/**
 * Fetch and assemble game weather report.
 *
 * If venue is not found or forecast is unavailable, returns minimal GameWeather
 * with empty hours array. If a forecast is available, returns ~4 hourly buckets
 * starting from the game's start time.
 *
 * @param args.venueId        Stadium ID (from MLB API)
 * @param args.startTimeISO   Game start time in ISO 8601 format
 * @param args.observed       MLB's own live/started-game observation snapshot
 * @returns Complete GameWeather report
 */
export async function getGameWeather(args: {
  venueId: number | undefined;
  startTimeISO: string;
  observed: { condition?: string; tempF?: string; wind?: string } | null;
}): Promise<GameWeather> {
  // Step 1: Look up ballpark by venue ID
  const ballpark = getBallpark(args.venueId);

  if (!ballpark) {
    // No coordinates available — return minimal report
    return {
      ballpark: null,
      elevationFt: null,
      roof: null,
      hours: [],
      gametime: null,
      tempRangeF: null,
      humidityPct: null,
      observed: args.observed
        ? mapObserved(args.observed)
        : null,
    };
  }

  // Step 2: Derive the game's UTC calendar date and fetch forecast.
  // Fetch a 2-day UTC window (game day + next day) so games starting late in
  // the UTC day still have enough following hours for the 4-bucket selection.
  const gameDateUTC = args.startTimeISO.slice(0, 10);
  const { hours: forecastHours } = await fetchHourlyForecast(
    ballpark.lat,
    ballpark.lon,
    gameDateUTC,
    shiftDate(gameDateUTC, 1),
  );

  // Step 3: Select hourly buckets: closest at-or-after startTimeISO, plus next 3
  const selectedHours = selectHourlyBuckets(args.startTimeISO, forecastHours);

  // Step 4: Map to WeatherHour domain type
  const hours = selectedHours.map((point) => {
    const windRelative = windRelativeToPlate(
      point.windDirectionDeg,
      point.windSpeedMph,
      ballpark.cfBearingDeg,
      point.windGustMph,
    );
    const { sky, label: skyLabel } = weatherCodeToSky(point.weatherCode);

    return {
      timeISO: point.timeISO,
      tempF: point.tempF,
      humidityPct: point.humidityPct,
      sky,
      skyLabel,
      cloudCoverPct: point.cloudCoverPct,
      precipProbabilityPct: point.precipProbabilityPct,
      wind: windRelative,
    } satisfies WeatherHour;
  });

  // Step 5-6: Compute gametime, temp range, and use static elevation/roof
  const gametime = hours[0] ?? null;
  const tempRangeF =
    hours.length > 0
      ? {
          min: Math.min(...hours.map((h) => h.tempF)),
          max: Math.max(...hours.map((h) => h.tempF)),
        }
      : null;
  const humidityPct = hours[0]?.humidityPct ?? null;

  // Step 7: Map observed if provided
  const observed = args.observed ? mapObserved(args.observed) : null;

  return {
    ballpark,
    elevationFt: ballpark.elevationFt,
    roof: ballpark.roof,
    hours,
    gametime,
    tempRangeF,
    humidityPct,
    observed,
  };
}

/**
 * Select hourly forecast buckets: the one at-or-after startTimeISO,
 * plus the next 3 (up to 4 total, fewer if near end of available data).
 *
 * @param startTimeISO ISO 8601 timestamp
 * @param forecastHours Array of hourly forecast points
 * @returns Selected forecast points (0 to 4 items)
 */
function selectHourlyBuckets(
  startTimeISO: string,
  forecastHours: HourlyForecastPoint[],
): HourlyForecastPoint[] {
  // Find the first bucket at-or-after startTimeISO
  const startIdx = forecastHours.findIndex(
    (point) => point.timeISO >= startTimeISO,
  );

  if (startIdx === -1) {
    // No buckets at or after start time
    return [];
  }

  // Return from startIdx through the next 3 buckets (4 total max)
  return forecastHours.slice(startIdx, startIdx + 4);
}

/**
 * Map MLB's observed weather snapshot to domain type.
 */
function mapObserved(input: {
  condition?: string;
  tempF?: string;
  wind?: string;
}): { condition?: string; tempF?: number; windText?: string } {
  return {
    condition: input.condition,
    tempF: input.tempF ? parseFloat(input.tempF) : undefined,
    windText: input.wind,
  };
}
