import { daysBetween } from "@/lib/dates";
import type { OpeningDay } from "@/lib/mlb/types";

function prettyDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Days-to-go card for the next Opening Day. Pure UTC date math against the
 * YYYY-MM-DD strings — no game-time clocks, since start times here are
 * placeholders until the day is set.
 */
export default function OpeningDayCountdown({
  openingDay,
  today,
}: {
  openingDay: OpeningDay;
  today: string;
}) {
  const daysToOpener = daysBetween(today, openingDay.date);
  const springDays = openingDay.springStart
    ? daysBetween(today, openingDay.springStart)
    : null;

  return (
    <div className="rounded-md border border-ink/15 bg-card p-4 shadow-sm">
      {daysToOpener > 0 ? (
        <p className="font-display text-2xl font-bold uppercase leading-none tracking-wide">
          {daysToOpener} {daysToOpener === 1 ? "day" : "days"} to Opening Day
        </p>
      ) : daysToOpener === 0 ? (
        <p className="font-display text-2xl font-bold uppercase leading-none tracking-wide">
          Opening Day is today
        </p>
      ) : (
        <p className="font-display text-2xl font-bold uppercase leading-none tracking-wide">
          Opening Day was {prettyDate(openingDay.date)}
        </p>
      )}
      {daysToOpener >= 0 && (
        <p className="mt-1 text-sm text-ink/65">{prettyDate(openingDay.date)}</p>
      )}
      {springDays !== null && springDays > 0 && (
        <p className="nums mt-2 text-xs text-ink/65">
          Spring training starts {shortDate(openingDay.springStart!)}
        </p>
      )}
    </div>
  );
}
