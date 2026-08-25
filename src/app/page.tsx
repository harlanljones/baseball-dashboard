import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import GameCard from "@/components/GameCard";
import BestLeansSection from "@/components/BestLeansSection";
import PageContainer from "@/components/PageContainer";
import { easternToday, shiftDate } from "@/lib/mlb/client";
import { getSchedule } from "@/lib/mlb/schedule";

// This route renders per-request because it awaits `searchParams` (a
// request-time API). Don't add `dynamic = "force-dynamic"` — in Next 16 that
// forces every fetch to `no-store`, defeating the TTL caching in mlbFetch.

function prettyDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const today = easternToday();
  const date = dateParam ?? today;

  const { games, hasLiveGame } = await getSchedule(date);
  const prev = shiftDate(date, -1);
  const next = shiftDate(date, 1);

  return (
    <PageContainer>
      <AutoRefresh enabled={hasLiveGame} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">
            {date === today ? "Today's Games" : "Games"}
          </h1>
          <p className="mt-1 text-sm text-ink/65">{prettyDate(date)}</p>
        </div>
        <nav
          aria-label="Date navigation"
          className="flex divide-x divide-ink/15 rounded-md border border-ink/15 bg-card text-sm shadow-sm"
        >
          <Link
            href={`/?date=${prev}`}
            className="inline-flex items-center whitespace-nowrap rounded-l-md px-3.5 py-2 hover:bg-field/5"
          >
            ← Prev
          </Link>
          {date !== today && (
            <Link
              href="/"
              className="inline-flex items-center whitespace-nowrap px-3.5 py-2 hover:bg-field/5"
            >
              Today
            </Link>
          )}
          <Link
            href={`/?date=${next}`}
            className="inline-flex items-center whitespace-nowrap rounded-r-md px-3.5 py-2 hover:bg-field/5"
          >
            Next →
          </Link>
        </nav>
      </div>

      {games.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink/20 py-16 text-center">
          <p className="font-display text-lg font-semibold uppercase tracking-wide">
            No games scheduled
          </p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-ink/65">
            Even the diamond needs a day off. Try an adjacent date.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Link
              href={`/?date=${prev}`}
              className="inline-flex items-center rounded-md border border-ink/15 bg-card px-3 py-2 text-sm shadow-sm hover:bg-field/5"
            >
              ← {prettyDate(prev).split(", ").slice(-2).join(", ")}
            </Link>
            <Link
              href={`/?date=${next}`}
              className="inline-flex items-center rounded-md border border-ink/15 bg-card px-3 py-2 text-sm shadow-sm hover:bg-field/5"
            >
              {prettyDate(next).split(", ").slice(-2).join(", ")} →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <BestLeansSection games={games} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {games.map((game) => (
              <GameCard key={game.gamePk} game={game} />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
