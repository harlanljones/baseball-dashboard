import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GameStatusBadge from "@/components/GameStatusBadge";
import LocalTime from "@/components/LocalTime";
import PlayerPropsBoard from "@/components/PlayerPropsBoard";
import TeamLogo from "@/components/TeamLogo";
import { loadPropGroups } from "@/components/PropsSidebarSection";
import { propContextFromFeed } from "@/lib/odds/board";
import { getLiveFeed, seasonOf } from "@/lib/mlb/game";
import { MlbApiError } from "@/lib/mlb/client";
import type { GameFeed } from "@/lib/mlb/types";
import { getGameWeather } from "@/lib/weather/report";
import type { GameWeather } from "@/lib/weather/types";

async function safe<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ gamePk: string }> }): Promise<Metadata> {
  const { gamePk } = await params;
  const id = Number(gamePk);
  if (!Number.isInteger(id) || id <= 0) return { title: "Player props" };
  try {
    const feed = await getLiveFeed(id);
    return {
      title: `${feed.away.team.name} @ ${feed.home.team.name} player props`,
      description: `Weighted player-prop leans for ${feed.away.team.name} at ${feed.home.team.name}.`,
    };
  } catch {
    return { title: "Player props" };
  }
}

export default async function PlayerPropsPage({ params }: { params: Promise<{ gamePk: string }> }) {
  const { gamePk } = await params;
  const id = Number(gamePk);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let feed: GameFeed;
  try {
    feed = await getLiveFeed(id);
  } catch (error) {
    if (error instanceof MlbApiError && error.status === 404) notFound();
    throw error;
  }

  const isPreview = feed.state === "Preview";
  const weather: GameWeather | null = isPreview
    ? await safe(
        getGameWeather({
          venueId: feed.venueId,
          startTimeISO: feed.startTime,
          observed: feed.weather ?? null,
        }),
      )
    : null;
  // Passing the feed opts this surface into the per-player matchup evidence it
  // renders beneath each prop.
  const groups = isPreview
    ? await loadPropGroups({
        game: propContextFromFeed(feed),
        season: seasonOf(feed),
        weather,
        feed,
      })
    : [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/games/${id}`} className="text-sm text-ink/65 underline-offset-4 hover:text-ink hover:underline">
          Back to game overview
        </Link>
        <Link href="/" className="text-sm text-ink/65 underline-offset-4 hover:text-ink hover:underline">All games</Link>
      </div>

      <header className="mt-4 rounded-md border border-ink/10 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GameStatusBadge game={feed} />
          {isPreview && feed.startTime && <LocalTime iso={feed.startTime} weekday />}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="flex items-center gap-2.5 font-display text-2xl font-semibold">
            <TeamLogo teamId={feed.away.team.id} size={32} />
            <span>{feed.away.team.name}</span>
          </div>
          <span className="font-display text-sm uppercase tracking-[0.14em] text-ink/65">at</span>
          <div className="flex items-center gap-2.5 font-display text-2xl font-semibold md:justify-end">
            <TeamLogo teamId={feed.home.team.id} size={32} />
            <span>{feed.home.team.name}</span>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink/10 pt-3 text-xs text-ink/65">
          {feed.venue && <span>{[feed.venue, feed.venueCity].filter(Boolean).join(", ")}</span>}
          {feed.probablePitchers.away && <span>{feed.away.team.abbreviation} probable: {feed.probablePitchers.away.fullName}</span>}
          {feed.probablePitchers.home && <span>{feed.home.team.abbreviation} probable: {feed.probablePitchers.home.fullName}</span>}
        </div>
      </header>

      <nav aria-label="Game detail navigation" className="mt-4 flex gap-1 border-b border-ink/10">
        <Link href={`/games/${id}`} className="px-3 py-2 text-sm text-ink/65 hover:text-ink">Overview</Link>
        <Link href={`/games/${id}/props`} aria-current="page" className="border-b-2 border-gold px-3 py-2 text-sm font-semibold text-ink">Player props</Link>
      </nav>

      <main className="mt-5">
        {!isPreview ? (
          <div className="rounded-md border border-dashed border-ink/20 bg-card px-5 py-12 text-center">
            <h1 className="font-display text-xl font-semibold uppercase">Player props are closed</h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink/65">Prop analysis is available while the game is in preview. Return to the overview for live or final game data.</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-wide">Player props</h1>
              <p className="mt-1 max-w-xl text-sm text-ink/65">Compare weighted leans for this game. Scores are research signals, not guarantees.</p>
            </div>
            <PlayerPropsBoard groups={groups} gameHref={`/games/${id}`} />
          </>
        )}
      </main>
    </div>
  );
}
