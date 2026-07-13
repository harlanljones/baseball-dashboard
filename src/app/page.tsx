import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import GameCard from "@/components/GameCard";
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
    <div>
      <AutoRefresh enabled={hasLiveGame} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {date === today ? "Today's Games" : "Games"}
          </h1>
          <p className="text-sm text-neutral-500">{prettyDate(date)}</p>
        </div>
        <nav aria-label="Date navigation" className="flex items-center gap-1 text-sm">
          <Link
            href={`/?date=${prev}`}
            className="rounded-md border border-neutral-200 px-2.5 py-1 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
          >
            ← Prev
          </Link>
          {date !== today && (
            <Link
              href="/"
              className="rounded-md border border-neutral-200 px-2.5 py-1 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
            >
              Today
            </Link>
          )}
          <Link
            href={`/?date=${next}`}
            className="rounded-md border border-neutral-200 px-2.5 py-1 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800"
          >
            Next →
          </Link>
        </nav>
      </div>

      {games.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 py-16 text-center dark:border-neutral-700">
          <p className="text-neutral-600 dark:text-neutral-400">
            No games scheduled for this date.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Try the previous or next day.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.gamePk} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
