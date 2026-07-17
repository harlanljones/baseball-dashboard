import type { Sky, WindRelative, WindCategory } from "./types";

function normalize(angle: number): number {
  let normalized = angle % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return normalized;
}

function getCoarseZoneLabel(
  alpha: number,
  category: "out" | "in" | "cross-l-to-r" | "cross-r-to-l",
): string {
  const absMag = Math.abs(alpha);

  if (category === "out") {
    if (absMag <= 15) return "center";
    if (alpha > 0) return "right-center";
    return "left-center";
  }

  if (category === "in") {
    if (absMag <= 165) {
      if (alpha > 0) return "right field";
      return "left field";
    }
    return "center";
  }

  return "";
}

export function windRelativeToPlate(
  windFromDeg: number,
  speedMph: number,
  cfBearingDeg: number,
  gustMph?: number,
): WindRelative {
  const towardDeg = (windFromDeg + 180) % 360;
  const alpha = normalize(towardDeg - cfBearingDeg);

  let category: WindCategory;
  if (speedMph < 2) {
    category = "calm";
  } else if (Math.abs(alpha) <= 45) {
    category = "out";
  } else if (Math.abs(alpha) >= 135) {
    category = "in";
  } else if (alpha > 0) {
    category = "cross-l-to-r";
  } else {
    category = "cross-r-to-l";
  }

  let label: string;
  if (category === "calm") {
    label = "Calm";
  } else if (category === "out") {
    const zone = getCoarseZoneLabel(alpha, category);
    label = `Out to ${zone}`;
  } else if (category === "in") {
    const zone = getCoarseZoneLabel(alpha, category);
    label = `In from ${zone}`;
  } else if (category === "cross-l-to-r") {
    label = "Crosswind, left to right";
  } else {
    label = "Crosswind, right to left";
  }

  return {
    plateRelativeDeg: alpha,
    category,
    label,
    speedMph,
    gustMph,
  };
}

export function weatherCodeToSky(wmoCode: number): { sky: Sky; label: string } {
  if (wmoCode === 0) return { sky: "clear", label: "Clear" };
  if (wmoCode === 1) return { sky: "partly-cloudy", label: "Partly cloudy" };
  if (wmoCode === 2) return { sky: "cloudy", label: "Mostly cloudy" };
  if (wmoCode === 3) return { sky: "cloudy", label: "Overcast" };
  if (wmoCode === 45 || wmoCode === 48) return { sky: "fog", label: "Fog" };
  if (wmoCode >= 51 && wmoCode <= 57) return { sky: "drizzle", label: "Drizzle" };
  if (wmoCode >= 61 && wmoCode <= 67) return { sky: "rain", label: "Rain" };
  if (wmoCode >= 71 && wmoCode <= 77) return { sky: "snow", label: "Snow" };
  if (wmoCode >= 80 && wmoCode <= 82) return { sky: "rain", label: "Rain showers" };
  if (wmoCode >= 95 && wmoCode <= 99) return { sky: "thunderstorm", label: "Thunderstorms" };
  return { sky: "unknown", label: "Unknown" };
}

export function degToCompass(deg: number): string {
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
  ];
  const normalized = ((deg + 360) % 360);
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}
