import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AutoRefresh from "@/components/AutoRefresh";
import LocalTime from "@/components/LocalTime";
import BoxscoreTables from "@/components/BoxscoreTables";
import Bullpen from "@/components/Bullpen";
import BallparkWeather from "@/components/BallparkWeather";
import GameStatusBadge from "@/components/GameStatusBadge";
import HeadToHead from "@/components/HeadToHead";
import Linescore from "@/components/Linescore";
import ScorePop from "@/components/ScorePop";
import MatchupsSection from "@/components/MatchupsSection";
import ProbableStartersSection from "@/components/ProbableStartersSection";
import GameLogSection from "@/components/GameLogSection";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import RosterStatsSection from "@/components/RosterStatsSection";
import TeamLogo from "@/components/TeamLogo";

import { easternDateOf, MlbApiError } from "@/lib/mlb/client";
import { getLiveFeed, seasonOf } from "@/lib/mlb/game";
import {
  getBullpenSeasonPitching,
  getBullpenWorkload,
} from "@/lib/mlb/players";
import { getHeadToHead } from "@/lib/mlb/schedule";
import { getGameWeather } from "@/lib/weather/report";
import type { GameWeather } from "@/lib/weather/types";
import GameSplitPane from "@/components/GameSplitPane";
import type {
  BullpenPitcher,
  GameFeed,
  TeamBoxscore,
} from "@/lib/mlb/types";

// --- small utilities ---------------------------------------------------------

function teamName(t: { abbreviation?: string; name: string }): string {
  return t.abbreviation ?? t.name;
}

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

function SectionError({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay-deep">
      Couldn’t load {label} right now.
    </p>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="eyebrow text-lg">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/**
 * Reference-tier section (season series, game log): same card, but collapsed
 * behind its own title so the research path isn't buried under reference data.
 */
function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-ink/10 bg-card p-4 shadow-sm">
      <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <h2 className="eyebrow text-base transition-colors group-hover:text-ink">{title}</h2>
        <span
          aria-hidden
          className="text-ink/65 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function SectionSkeleton() {
  return (
    <div className="h-24 animate-pulse rounded bg-ink/10" />
  );
}

// --- async sections ----------------------------------------------------------

function withBullpenStats(
  box: TeamBoxscore,
  workload: Map<number, { yesterday: number; last3: number }>,
  seasonPitching: Map<number, { ip: string; era?: string; fip?: number; k: number }>,
): TeamBoxscore {
  return {
    ...box,
    bullpen: box.bullpen.map((p): BullpenPitcher => {
      const stats = seasonPitching.get(p.id);
      return {
        ...p,
        ...(stats ?? {}),
        pitchesYesterday: workload.get(p.id)?.yesterday,
        pitchesLast3: workload.get(p.id)?.last3,
      };
    }),
  };
}

async function BullpenSection({
  feed,
  season,
}: {
  feed: GameFeed;
  season: number;
}) {
  const gameDate = easternDateOf(feed.startTime || new Date());
  const awayIds = feed.boxscore.away.bullpen.map((p) => p.id);
  const homeIds = feed.boxscore.home.bullpen.map((p) => p.id);

  const fetched = await safe(
    Promise.all([
      getBullpenWorkload(awayIds, season, gameDate),
      getBullpenWorkload(homeIds, season, gameDate),
      getBullpenSeasonPitching(awayIds, season),
      getBullpenSeasonPitching(homeIds, season),
    ]),
  );

  if (!fetched) {
    return <Bullpen away={feed.boxscore.away} home={feed.boxscore.home} />;
  }
  const [awayWorkload, homeWorkload, awaySeasonPitching, homeSeasonPitching] = fetched;
  return (
    <Bullpen
      away={withBullpenStats(feed.boxscore.away, awayWorkload, awaySeasonPitching)}
      home={withBullpenStats(feed.boxscore.home, homeWorkload, homeSeasonPitching)}
    />
  );
}

async function HeadToHeadSection({
  feed,
  season,
}: {
  feed: GameFeed;
  season: number;
}) {
  // Await inside try/catch, build JSX outside — a try/catch cannot catch errors
  // thrown while React later renders returned JSX.
  const h2h = await safe(getHeadToHead(feed.away.team, feed.home.team, season));
  if (!h2h) return <SectionError label="the season series" />;
  return <HeadToHead h2h={h2h} />;
}

function WeatherSection({ weather }: { weather: GameWeather | null }) {
  if (!weather) return <SectionError label="ballpark weather" />;
  return <BallparkWeather weather={weather} />;
}


// --- page --------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ gamePk: string }>;
}): Promise<Metadata> {
  const { gamePk } = await params;
  const id = Number(gamePk);
  if (!Number.isInteger(id) || id <= 0) return { title: "Game not found" };

  // Shares the page's fetch via per-request memoization — no extra API call.
  try {
    const feed = await getLiveFeed(id);
    const away = teamName(feed.away.team);
    const home = teamName(feed.home.team);
    const scored = feed.state === "Live" || feed.state === "Final";
    const suffix = scored
      ? ` — ${feed.state === "Live" ? "Live" : "Final"} ${feed.away.score ?? 0}-${feed.home.score ?? 0}`
      : "";
    return {
      title: `${away} @ ${home}${suffix}`,
      description: `Score, boxscore, matchups, and sabermetrics for ${feed.away.team.name} at ${feed.home.team.name}.`,
    };
  } catch {
    return { title: "Game" };
  }
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ gamePk: string }>;
}) {
  const { gamePk } = await params;
  const id = Number(gamePk);
  if (!Number.isInteger(id) || id <= 0) notFound();

  let feed: GameFeed;
  try {
    feed = await getLiveFeed(id);
  } catch (e) {
    if (e instanceof MlbApiError && e.status === 404) notFound();
    throw e;
  }

  const season = seasonOf(feed);
  const scored = feed.state === "Live" || feed.state === "Final";
  const isPreview = feed.state === "Preview";
  const isDisrupted = /Postponed|Suspended|Cancel/i.test(feed.detailedState);
  const d = feed.decisions;

  const weather =
    !isDisrupted && (isPreview || feed.state === "Live")
      ? await safe(
          getGameWeather({
            venueId: feed.venueId,
            startTimeISO: feed.startTime,
            observed: feed.weather ?? null,
          }),
        )
      : null;

  // Back link + game header + disruption note. Rendered as the first children
  // of the split pane's main column so it shares that column's centered
  // max-width when the props sidebar is collapsed or absent.
  const header = (
    <>
      <Link
        href="/"
        className="inline-block text-sm text-ink/65 hover:text-ink"
      >
        ← All games
      </Link>

      {/* Header */}
      <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
        <h1 className="sr-only">
          {feed.away.team.name} at {feed.home.team.name}
        </h1>
        <div className="mb-3 flex items-center justify-between gap-3">
          <GameStatusBadge game={{ state: feed.state, detailedState: feed.detailedState }} />
          <div className="flex items-center gap-4">
            {isPreview && feed.startTime && (
              <span className="font-mono text-sm text-ink/65">
                <LocalTime iso={feed.startTime} weekday />
              </span>
            )}
            {!isDisrupted && isPreview && (
              <Link href={`/games/${id}/props`} className="rounded-md border border-gold-deep/40 px-2.5 py-1 text-xs font-semibold text-gold-deep hover:bg-gold/10">
                Analyze player props
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-display flex items-center gap-2.5 text-xl font-semibold">
            <TeamLogo teamId={feed.away.team.id} size={28} />
            {feed.away.team.name}
          </span>
          {scored && (
            <ScorePop value={feed.away.score ?? "-"} className="font-mono text-xl font-semibold" />
          )}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-display flex items-center gap-2.5 text-xl font-semibold">
            <TeamLogo teamId={feed.home.team.id} size={28} />
            {feed.home.team.name}
          </span>
          {scored && (
            <ScorePop value={feed.home.score ?? "-"} className="font-mono text-xl font-semibold" />
          )}
        </div>

        {feed.venue && (
          <p className="mt-2 text-xs text-ink/65">
            {[feed.venue, feed.venueCity].filter(Boolean).join(", ")}
          </p>
        )}

        {feed.state === "Final" && (d?.winner || d?.loser) && (
          <p className="mt-3 border-t border-ink/10 pt-2 text-xs text-ink/65">
            {d?.winner && <>W: {d.winner.fullName}</>}
            {d?.loser && <> · L: {d.loser.fullName}</>}
            {d?.save && <> · SV: {d.save.fullName}</>}
          </p>
        )}

        {isPreview && (feed.probablePitchers.away || feed.probablePitchers.home) && (
          <div className="mt-3 border-t border-ink/10 pt-2 text-sm text-ink/65">
            <span className="mr-3">Probables:</span>
            <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1 align-middle">
              {(["away", "home"] as const).map((side) => {
                const pitcher = feed.probablePitchers[side];
                return (
                  <span key={side} className="inline-flex items-center gap-1.5">
                    {pitcher && <PlayerHeadshot personId={pitcher.id} size={22} />}
                    <span className="text-ink/65">
                      {teamName(feed[side].team)}
                    </span>
                    {pitcher?.fullName ?? "TBD"}
                  </span>
                );
              })}
            </span>
          </div>
        )}
      </div>

      {isDisrupted && (
        <p className="rounded-md border border-ink/15 bg-field/5 px-3 py-2 text-sm text-ink/75">
          This game is {feed.detailedState.toLowerCase()}. Sections below reflect season data, not today’s result.
        </p>
      )}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AutoRefresh enabled={feed.state === "Live"} />

      <GameSplitPane
        main={
          <>
            {header}

            {/* Probable starters */}
            {!isDisrupted && isPreview && (
              <Section title="Probable starters">
                <Suspense fallback={<SectionSkeleton />}>
                  <ProbableStartersSection feed={feed} season={season} />
                </Suspense>
              </Section>
            )}

            {/* Ballpark weather */}
            {!isDisrupted && (isPreview || feed.state === "Live") && (
              <Section title="Ballpark weather">
                <WeatherSection weather={weather} />
              </Section>
            )}

            {/* 1. Linescore + boxscore (from the feed) */}
            {scored && !isDisrupted && (
              <Section title="Boxscore">
                <div className="space-y-4">
                  <Linescore feed={feed} />
                  <BoxscoreTables
                    away={feed.boxscore.away}
                    home={feed.boxscore.home}
                    isLive={feed.state === "Live"}
                  />
                </div>
              </Section>
            )}

            {/* Game log (reference tier) */}
            {scored && !isDisrupted && (
              <CollapsibleSection title="Game log">
                <Suspense fallback={<SectionSkeleton />}>
                  <GameLogSection feed={feed} />
                </Suspense>
              </CollapsibleSection>
            )}

            {/* 2. Bullpen (also from the feed) */}
            {!isDisrupted &&
              (feed.boxscore.away.bullpen.length > 0 ||
                feed.boxscore.home.bullpen.length > 0) && (
                <Section title={scored ? "Bullpen (available arms)" : "Bullpen"}>
                  <Suspense fallback={<SectionSkeleton />}>
                    <BullpenSection feed={feed} season={season} />
                  </Suspense>
                </Section>
              )}

            {/* 3. Head-to-head (reference tier) */}
            <CollapsibleSection title="Season series">
              <Suspense fallback={<SectionSkeleton />}>
                <HeadToHeadSection feed={feed} season={season} />
              </Suspense>
            </CollapsibleSection>

            {/* 4. Batter vs pitcher */}
            <Section title="Matchups">
              <MatchupsSection gamePk={id} />
            </Section>

            {/* 5. Sabermetrics */}
            <Section
              title="Sabermetric evaluations"
              aside={
                <a
                  href="/glossary"
                  className="text-xs text-grass underline underline-offset-2 hover:text-field-deep dark:hover:text-grass"
                >
                  Glossary
                </a>
              }
            >
              <RosterStatsSection gamePk={id} />
            </Section>
          </>
        }
      />
    </div>
  );
}
