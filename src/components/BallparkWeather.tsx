import type { GameWeather } from "@/lib/weather/types";
import { LocalHour } from "@/components/LocalTime";
import type React from "react";

/**
 * Weather glyphs — minimal hand-authored inline SVG, ~16-20px, currentColor.
 */

function SunGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <line
          key={deg}
          x1="10"
          y1="2"
          x2="10"
          y2="3.5"
          stroke="currentColor"
          strokeWidth="1"
          transform={`rotate(${deg} 10 10)`}
        />
      ))}
    </svg>
  );
}

function CloudGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M16 11a3 3 0 0 0-5.5-1.5A4 4 0 1 0 4 12h12z"
        fill="currentColor"
      />
    </svg>
  );
}

function RainGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M16 11a3 3 0 0 0-5.5-1.5A4 4 0 1 0 4 12h12z"
        fill="currentColor"
      />
      {[3, 9, 15].map((x) => (
        <line
          key={x}
          x1={x}
          y1="15"
          x2={x - 1.5}
          y2="19"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function ThunderstormGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M16 11a3 3 0 0 0-5.5-1.5A4 4 0 1 0 4 12h12z"
        fill="currentColor"
      />
      <path d="M9 15l-1 3h2l-1 3m3-6l-1 3h2l-1 3" stroke="currentColor" />
    </svg>
  );
}

function SnowGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M16 11a3 3 0 0 0-5.5-1.5A4 4 0 1 0 4 12h12z"
        fill="currentColor"
      />
      {[3, 9, 15].map((x) => (
        <g key={x} transform={`translate(${x} 16)`}>
          <line x1="0" y1="-1.5" x2="0" y2="1.5" stroke="currentColor" />
          <line
            x1="-1.3"
            y1="-0.75"
            x2="1.3"
            y2="0.75"
            stroke="currentColor"
          />
          <line
            x1="-1.3"
            y1="0.75"
            x2="1.3"
            y2="-0.75"
            stroke="currentColor"
          />
        </g>
      ))}
    </svg>
  );
}

function FogGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      {[2, 6, 10, 14].map((y) => (
        <line
          key={y}
          x1="2"
          y1={y}
          x2="18"
          y2={y}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
        />
      ))}
    </svg>
  );
}

function DrizzleGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        d="M16 11a3 3 0 0 0-5.5-1.5A4 4 0 1 0 4 12h12z"
        fill="currentColor"
      />
      {[5, 11].map((x) => (
        <line
          key={x}
          x1={x}
          y1="15"
          x2={x - 0.5}
          y2="17"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}


function DomeGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M3 10h14a7 7 0 1 0-14 0z" stroke="currentColor" fill="none" />
      <line x1="10" y1="3" x2="10" y2="10" stroke="currentColor" />
    </svg>
  );
}

function RetractableGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="inline-block h-4 w-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M3 8h14l-7-5-7 5z" stroke="currentColor" strokeWidth="1" />
      <path
        d="M5 8h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"
        stroke="currentColor"
      />
    </svg>
  );
}

function getSkyGlyph(sky: string) {
  switch (sky) {
    case "clear":
      return <SunGlyph />;
    case "partly-cloudy":
      return <CloudGlyph />;
    case "cloudy":
      return <CloudGlyph />;
    case "fog":
      return <FogGlyph />;
    case "drizzle":
      return <DrizzleGlyph />;
    case "rain":
      return <RainGlyph />;
    case "thunderstorm":
      return <ThunderstormGlyph />;
    case "snow":
      return <SnowGlyph />;
    default:
      return <CloudGlyph />;
  }
}

/**
 * Wind direction SVG arrow glyph, scales with rotation and color.
 */
function WindArrow({
  rotationDeg,
  category,
  size = "medium",
}: {
  rotationDeg: number;
  category: string;
  size?: "small" | "medium" | "large";
}) {
  const sizeMap = {
    small: "16px",
    medium: "24px",
    large: "32px",
  };
  const viewSize = { small: "16", medium: "24", large: "32" }[size];

  let colorClass = "text-ink/40";
  if (category === "out") {
    colorClass = "text-hot";
  } else if (category === "in") {
    colorClass = "text-cold";
  }

  const scale = parseInt(viewSize) / 24;

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        transform: `rotate(${rotationDeg}deg)`,
      }}
      className={`inline-block flex-shrink-0 ${colorClass}`}
      aria-hidden="true"
    >
      <line
        x1={parseInt(viewSize) / 2}
        y1={parseInt(viewSize) - 2 * scale}
        x2={parseInt(viewSize) / 2}
        y2={2 * scale}
        stroke="currentColor"
        strokeWidth={1 * scale}
      />
      <polygon
        points={`${parseInt(viewSize) / 2},${2 * scale} ${parseInt(viewSize) / 2 - 2 * scale},${5 * scale} ${parseInt(viewSize) / 2 + 2 * scale},${5 * scale}`}
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Home plate / field diagram SVG
 */
function WindFieldDiagram({ weather }: { weather: GameWeather }) {
  const svgSize = 200;
  const centerX = svgSize / 2;
  const centerY = 150;
  const plateSizeX = 20;
  const plateSizeY = 15;

  const foulLineLength = 80;
  const outfieldRadius = 90;

  const windDeg = weather.gametime?.wind.plateRelativeDeg ?? 0;
  const windCategory = weather.gametime?.wind.category ?? "calm";

  return (
    <svg
      viewBox={`0 0 ${svgSize} ${svgSize}`}
      className="w-full max-w-xs"
      aria-hidden="true"
    >
      {/* Foul lines (left and right) */}
      <line
        x1={centerX}
        y1={centerY}
        x2={centerX - foulLineLength * Math.sin(Math.PI / 4)}
        y2={centerY - foulLineLength * Math.cos(Math.PI / 4)}
        stroke="currentColor"
        strokeWidth="1"
        className="text-ink/20"
      />
      <line
        x1={centerX}
        y1={centerY}
        x2={centerX + foulLineLength * Math.sin(Math.PI / 4)}
        y2={centerY - foulLineLength * Math.cos(Math.PI / 4)}
        stroke="currentColor"
        strokeWidth="1"
        className="text-ink/20"
      />

      {/* Outfield arc */}
      <path
        d={`M ${centerX - outfieldRadius * Math.sin(Math.PI / 4)} ${centerY - outfieldRadius * Math.cos(Math.PI / 4)} A ${outfieldRadius} ${outfieldRadius} 0 0 1 ${centerX + outfieldRadius * Math.sin(Math.PI / 4)} ${centerY - outfieldRadius * Math.cos(Math.PI / 4)}`}
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        className="text-ink/20"
      />

      {/* CF label */}
      <text
        x={centerX}
        y={centerY - outfieldRadius - 8}
        textAnchor="middle"
        className="fill-ink/50 text-xs font-mono"
        fontSize="12"
      >
        CF
      </text>

      {/* Home plate (diamond) */}
      <polygon
        points={`${centerX},${centerY + plateSizeY} ${centerX + plateSizeX},${centerY} ${centerX},${centerY - plateSizeY} ${centerX - plateSizeX},${centerY}`}
        fill="currentColor"
        className="fill-ink/20"
      />

      {/* Wind arrow from center of home plate, pointing outward */}
      <g
        transform={`translate(${centerX}, ${centerY}) rotate(${windDeg})`}
      >
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="-50"
          strokeWidth="2"
          className={
            windCategory === "out"
              ? "stroke-hot"
              : windCategory === "in"
                ? "stroke-cold"
                : "stroke-ink/40"
          }
        />
        <polygon
          points="0,-50 -3,-40 3,-40"
          className={
            windCategory === "out"
              ? "fill-hot"
              : windCategory === "in"
                ? "fill-cold"
                : "fill-ink/40"
          }
        />
      </g>
    </svg>
  );
}

/**
 * StatTile: small card with eyebrow label and value/detail
 */
function StatTile({
  label,
  value,
  detail,
  glyph,
  deemphasize = false,
  highlight,
}: {
  label: string;
  value: string | number;
  detail?: string;
  glyph?: React.ReactNode;
  deemphasize?: boolean;
  highlight?: string;
}) {
  return (
    <div
      className={`rounded-md border border-ink/10 bg-card p-2.5 ${deemphasize ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        {glyph && <span className="text-ink/70">{glyph}</span>}
        <div className="eyebrow text-xs">{label}</div>
      </div>
      <div className="mt-1">
        <div className="font-display font-semibold text-ink">{value}</div>
        {detail && (
          <div className="mt-0.5 text-xs text-ink/50">{detail}</div>
        )}
        {highlight && (
          <div className="mt-1 text-xs font-medium text-gold">{highlight}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Hourly timeline cell
 */
function HourlyCell({
  hour,
  deemphasize = false,
}: {
  hour: {
    timeISO: string;
    tempF: number;
    sky: string;
    skyLabel: string;
    wind: { plateRelativeDeg: number; speedMph: number; category: string };
  };
  deemphasize?: boolean;
}) {
  return (
    <div
      className={`flex flex-none flex-col items-center gap-1.5 rounded-md border border-ink/10 bg-paper p-2 min-w-max ${deemphasize ? "opacity-60" : ""}`}
    >
      <div className="font-mono text-xs font-semibold text-ink">
        <LocalHour iso={hour.timeISO} />
      </div>
      <div>
        <WindArrow
          rotationDeg={hour.wind.plateRelativeDeg}
          category={hour.wind.category}
          size="small"
        />
      </div>
      <div className="nums font-mono text-xs text-ink">{hour.wind.speedMph}</div>
      <div className="flex items-center gap-1">
        {getSkyGlyph(hour.sky)}
        <span className="font-mono text-xs text-ink/70">{hour.tempF}°</span>
      </div>
    </div>
  );
}

/**
 * BallparkWeather — server component, renders weather report for a game.
 * Prop `weather` is a GameWeather object.
 * Prop `venueName` (optional) is used for context in error messages.
 *
 * Renders the *content* of a Section (not the Section shell itself — caller wraps it).
 */
export default function BallparkWeather({
  weather,
}: {
  weather: GameWeather;
}): React.ReactElement {
  // Handle no-data case early
  if (weather.ballpark === null) {
    return (
      <p className="text-sm text-ink/60">
        Weather data unavailable for this ballpark.
      </p>
    );
  }

  const roofType = weather.ballpark.roof;
  const elevationFt = weather.ballpark.elevationFt;
  const isDomed = roofType !== "open";

  const gametimeTemp = weather.gametime?.tempF ?? null;
  const gametimeSky = weather.gametime?.sky ?? "unknown";
  const gametimePrecip = weather.gametime?.precipProbabilityPct ?? null;
  const tempRange = weather.tempRangeF;
  const humidityPct = weather.gametime?.humidityPct ?? null;

  // Roof label for display
  const roofLabel =
    roofType === "dome"
      ? "Dome"
      : roofType === "retractable"
        ? "Retractable roof"
        : "Open air";

  return (
    <div className="space-y-4">
      {/* Stat tile row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Ballpark type tile */}
        <StatTile
          label="Ballpark"
          value={roofLabel}
          glyph={
            roofType === "dome" ? (
              <DomeGlyph />
            ) : roofType === "retractable" ? (
              <RetractableGlyph />
            ) : (
              <SunGlyph />
            )
          }
        />

        {/* Elevation tile */}
        <StatTile
          label="Elevation"
          value={`${elevationFt} ft`}
          highlight={
            elevationFt >= 3000
              ? "High altitude — carries further."
              : undefined
          }
        />

        {/* Sky tile (de-emphasize if domed) */}
        <StatTile
          label="Sky"
          value={weather.gametime?.skyLabel ?? "—"}
          glyph={getSkyGlyph(gametimeSky)}
          deemphasize={isDomed}
        />

        {/* Temp tile (de-emphasize if domed) */}
        <StatTile
          label="Temp"
          value={gametimeTemp !== null ? `${gametimeTemp}°` : "—"}
          detail={
            tempRange
              ? `${tempRange.min}° → ${tempRange.max}°`
              : undefined
          }
          deemphasize={isDomed}
        />

        {/* Humidity tile */}
        <StatTile
          label="Humidity"
          value={humidityPct !== null ? `${humidityPct}%` : "—"}
        />

        {/* Precip tile (de-emphasize if domed) */}
        <StatTile
          label="Precip"
          value={gametimePrecip !== null ? `${gametimePrecip}%` : "—"}
          deemphasize={isDomed}
        />
      </div>

      {/* Dome/retractable note */}
      {isDomed && (
        <div className="border-t border-ink/10 pt-2 text-xs text-ink/60">
          {roofLabel} — outdoor conditions shown for reference; wind and sky
          won&apos;t affect play.
        </div>
      )}

      {/* Wind field diagram (only for open-air parks) */}
      {weather.gametime && roofType === "open" && (
        <div className="space-y-2 border-t border-ink/10 pt-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="max-w-xs">
              <WindFieldDiagram weather={weather} />
            </div>
            <div>
              <div className="font-display font-semibold text-ink">
                {weather.gametime.wind.label}
              </div>
              <div className="nums font-mono text-sm text-ink/70">
                {weather.gametime.wind.speedMph} mph
                {weather.gametime.wind.gustMph &&
                  weather.gametime.wind.gustMph >
                    weather.gametime.wind.speedMph + 5 && (
                    <>
                      <br />
                      +{weather.gametime.wind.gustMph} mph gusts
                    </>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hourly timeline */}
      {weather.hours.length > 0 && (
        <div className="space-y-2 border-t border-ink/10 pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink/60">
            Hourly
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {weather.hours.map((hour, i) => (
              <HourlyCell
                key={i}
                hour={hour}
                deemphasize={isDomed}
              />
            ))}
          </div>
        </div>
      )}

      {/* Observed data (MLB actuals) */}
      {weather.observed && (
        <div className="border-t border-ink/10 pt-2 text-xs text-ink/60">
          Observed:{" "}
          {[
            weather.observed.condition,
            weather.observed.tempF !== undefined
              ? `${weather.observed.tempF}°`
              : null,
            weather.observed.windText,
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      )}
    </div>
  );
}
