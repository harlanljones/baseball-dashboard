import OpeningDayCountdown from "@/components/OpeningDayCountdown";
import SeasonRecap from "@/components/SeasonRecap";
import StandingsTables from "@/components/StandingsTables";
import { getOpeningDay, getSeasonRecap } from "@/lib/mlb/season";
import { getStandings } from "@/lib/mlb/standings";
import type { DivisionStandings, OpeningDay, SeasonRecap as SeasonRecapData } from "@/lib/mlb/types";

/**
 * Three independent async sections for the offseason home page. Each awaits
 * its own endpoint and fails soft — a broken source hides only its own
 * section rather than the whole page. Data is fetched inside try/catch and
 * JSX is only constructed afterward, since JSX built inside a try block
 * isn't actually rendered (and so can't be caught) there.
 */

export async function CountdownSection({
  season,
  today,
}: {
  season: number;
  today: string;
}) {
  let openingDay: OpeningDay | null;
  try {
    openingDay = await getOpeningDay(season);
  } catch {
    return null;
  }
  if (!openingDay) return null;

  return <OpeningDayCountdown openingDay={openingDay} today={today} />;
}

export async function RecapSection({ season }: { season: number }) {
  let recap: SeasonRecapData;
  try {
    recap = await getSeasonRecap(season);
  } catch {
    return null;
  }
  if (recap.series.length === 0) return null;

  return (
    <section className="mb-5">
      <h2 className="eyebrow mb-2 text-base">{season} Postseason</h2>
      <SeasonRecap recap={recap} />
    </section>
  );
}

export async function StandingsSection({ season }: { season: number }) {
  let divisions: DivisionStandings[];
  try {
    divisions = await getStandings(season);
  } catch {
    return null;
  }
  if (divisions.length === 0) return null;

  return (
    <section className="mb-5">
      <h2 className="eyebrow mb-2 text-base">{season} Final Standings</h2>
      <StandingsTables season={season} divisions={divisions} />
    </section>
  );
}

/** animate-pulse placeholder block for a Suspense fallback around any of the above. */
export function OffseasonSectionSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="mb-5 h-40 animate-pulse rounded-md border border-ink/10 bg-card"
    />
  );
}
