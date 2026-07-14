import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AutoRefresh from "@/components/AutoRefresh";
import LocalTime from "@/components/LocalTime";
import BoxscoreTables from "@/components/BoxscoreTables";
import Bullpen from "@/components/Bullpen";
import GameStatusBadge from "@/components/GameStatusBadge";
import HeadToHead from "@/components/HeadToHead";
import Linescore from "@/components/Linescore";
import MatchupTable from "@/components/MatchupTable";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import SaberCard, { type SaberStat } from "@/components/SaberCard";
import TeamLogo from "@/components/TeamLogo";

import { easternDateOf, easternToday, MlbApiError } from "@/lib/mlb/client";
import { statClass } from "@/lib/statColor";
import { getLiveFeed } from "@/lib/mlb/game";
import {
  buildMatchups,
  lineupFor,
  startingPitcherFor,
} from "@/lib/mlb/matchup";
import {
  getBullpenWorkload,
  getSaberHitting,
  getSaberPitching,
} from "@/lib/mlb/players";
import { getHeadToHead } from "@/lib/mlb/schedule";
import type {
  BullpenPitcher,
  GameFeed,
  PlayerRef,
  SaberHitting,
  TeamBoxscore,
} from "@/lib/mlb/types";

// --- small utilities ---------------------------------------------------------

function seasonOf(feed: GameFeed): number {
  const iso = feed.startTime || `${easternToday()}T00:00:00Z`;
  return new Date(iso).getUTCFullYear();
}

function teamName(t: { abbreviation?: string; name: string }): string {
  return t.abbreviation ?? t.name;
}

/** Format a rate stat like wOBA as `.462` (three decimals, no leading zero). */
function rate3(n?: number): string {
  if (n == null) return "—";
  return n.toFixed(3).replace(/^0(?=\.)/, "");
}
function int(n?: number): string {
  return n == null ? "—" : String(Math.round(n));
}
function dec1(n?: number): string {
  return n == null ? "—" : n.toFixed(1);
}
function dec2(n?: number): string {
  return n == null ? "—" : n.toFixed(2);
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
    <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
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
        <h2 className="eyebrow text-base">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SectionSkeleton() {
  return (
    <div className="h-24 animate-pulse rounded bg-ink/10" />
  );
}

// --- async sections ----------------------------------------------------------

function withWorkload(
  box: TeamBoxscore,
  workload: Map<number, { yesterday: number; last3: number }>,
): TeamBoxscore {
  return {
    ...box,
    bullpen: box.bullpen.map(
      (p): BullpenPitcher => ({
        ...p,
        pitchesYesterday: workload.get(p.id)?.yesterday,
        pitchesLast3: workload.get(p.id)?.last3,
      }),
    ),
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
  const workload = await safe(
    Promise.all([
      getBullpenWorkload(
        feed.boxscore.away.bullpen.map((p) => p.id),
        season,
        gameDate,
      ),
      getBullpenWorkload(
        feed.boxscore.home.bullpen.map((p) => p.id),
        season,
        gameDate,
      ),
    ]),
  );

  if (!workload) {
    return <Bullpen away={feed.boxscore.away} home={feed.boxscore.home} />;
  }
  const [awayWorkload, homeWorkload] = workload;
  return (
    <Bullpen
      away={withWorkload(feed.boxscore.away, awayWorkload)}
      home={withWorkload(feed.boxscore.home, homeWorkload)}
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

async function MatchupSection({
  feed,
  season,
}: {
  feed: GameFeed;
  season: number;
}) {
  const matchups = await safe(buildMatchups(feed, season));
  if (!matchups) return <SectionError label="matchup history" />;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <MatchupTable side={matchups.awayPitching} />
      <MatchupTable side={matchups.homePitching} />
    </div>
  );
}

function hitterStats(s: SaberHitting | null): SaberStat[] {
  return [
    { label: "wOBA", value: rate3(s?.woba), className: statClass("woba", s?.woba) },
    { label: "wRC+", value: int(s?.wrcPlus), className: statClass("wrcPlus", s?.wrcPlus) },
    { label: "WAR", value: dec1(s?.war), className: statClass("warHitter", s?.war) },
    // BABIP is luck-driven — never graded good/bad.
    { label: "BABIP", value: s?.babip ?? "—" },
  ];
}

async function TeamSaber({
  feed,
  side,
  season,
}: {
  feed: GameFeed;
  side: "away" | "home";
  season: number;
}) {
  const team = feed[side].team;
  const pitcher = startingPitcherFor(feed, side);

  const data = await safe(
    (async () => {
      const lineup = await lineupFor(feed, side, season);
      const hitters = lineup.batters.slice(0, 4);
      const [pitchingStats, hittingStats] = await Promise.all([
        pitcher
          ? safe(getSaberPitching(pitcher.id, season))
          : Promise.resolve(null),
        Promise.all(hitters.map((h) => safe(getSaberHitting(h.id, season)))),
      ]);
      return { hitters, pitchingStats, hittingStats, isProxy: lineup.isProxy };
    })(),
  );

  if (!data) return <SectionError label={`${team.name} sabermetrics`} />;
  const { hitters, pitchingStats, hittingStats, isProxy } = data;

  return (
    <div className="min-w-0">
      <h3 className="font-display mb-2 flex items-center gap-2 text-base font-semibold">
        <TeamLogo teamId={team.id} size={18} />
        {team.name}
      </h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pitcher && (
          <SaberCard
            name={pitcher.fullName}
            subtitle="Starting pitcher"
            headshotId={pitcher.id}
            stats={[
              {
                label: "WAR",
                value: dec1(pitchingStats?.war),
                className: statClass("warPitcher", pitchingStats?.war),
              },
              {
                label: "FIP",
                value: dec2(pitchingStats?.fip),
                className: statClass("fip", pitchingStats?.fip),
              },
              {
                label: "xFIP",
                value: dec2(pitchingStats?.xfip),
                className: statClass("xfip", pitchingStats?.xfip),
              },
              {
                label: "ERA-",
                value: int(pitchingStats?.eraMinus),
                className: statClass("eraMinus", pitchingStats?.eraMinus),
              },
            ]}
          />
        )}
        {hitters.map((h: PlayerRef, i) => (
          <SaberCard
            key={h.id}
            name={h.fullName}
            subtitle="Hitter"
            stats={hitterStats(hittingStats[i])}
          />
        ))}
      </div>
      {isProxy && (
        <p className="mt-2 text-xs text-ink/50">
          Lineup not posted — showing roster leaders by PA.
        </p>
      )}
    </div>
  );
}

function SaberSection({ feed, season }: { feed: GameFeed; season: number }) {
  // Each TeamSaber isolates its own failures, so no try/catch is needed (and
  // one wouldn't catch errors thrown during async child rendering anyway).
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TeamSaber feed={feed} side="away" season={season} />
      <TeamSaber feed={feed} side="home" season={season} />
    </div>
  );
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

  return (
    <div className="space-y-5">
      <AutoRefresh enabled={feed.state === "Live"} />

      <Link
        href="/"
        className="inline-block text-sm text-ink/60 hover:text-ink"
      >
        ← All games
      </Link>

      {/* Header */}
      <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
        <h1 className="sr-only">
          {feed.away.team.name} at {feed.home.team.name}
        </h1>
        <div className="mb-3 flex items-center justify-between">
          <GameStatusBadge game={{ state: feed.state, detailedState: feed.detailedState }} />
          {isPreview && feed.startTime && (
            <span className="font-mono text-sm text-ink/60">
              <LocalTime iso={feed.startTime} weekday />
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-display flex items-center gap-2.5 text-xl font-semibold">
            <TeamLogo teamId={feed.away.team.id} size={28} />
            {feed.away.team.name}
          </span>
          {scored && (
            <span className="font-mono text-xl font-semibold">
              {feed.away.score ?? "-"}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-display flex items-center gap-2.5 text-xl font-semibold">
            <TeamLogo teamId={feed.home.team.id} size={28} />
            {feed.home.team.name}
          </span>
          {scored && (
            <span className="font-mono text-xl font-semibold">
              {feed.home.score ?? "-"}
            </span>
          )}
        </div>

        {feed.venue && (
          <p className="mt-2 text-xs text-ink/50">
            {[feed.venue, feed.venueCity].filter(Boolean).join(", ")}
          </p>
        )}

        {feed.state === "Final" && (d?.winner || d?.loser) && (
          <p className="mt-3 border-t border-ink/10 pt-2 text-xs text-ink/60">
            {d?.winner && <>W: {d.winner.fullName}</>}
            {d?.loser && <> · L: {d.loser.fullName}</>}
            {d?.save && <> · SV: {d.save.fullName}</>}
          </p>
        )}

        {isPreview && (feed.probablePitchers.away || feed.probablePitchers.home) && (
          <div className="mt-3 border-t border-ink/10 pt-2 text-sm text-ink/60">
            <span className="mr-3">Probables:</span>
            <span className="inline-flex flex-wrap items-center gap-x-5 gap-y-1 align-middle">
              {(["away", "home"] as const).map((side) => {
                const pitcher = feed.probablePitchers[side];
                return (
                  <span key={side} className="inline-flex items-center gap-1.5">
                    {pitcher && <PlayerHeadshot personId={pitcher.id} size={22} />}
                    <span className="text-ink/40">
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
        <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
          This game is {feed.detailedState.toLowerCase()}.
        </p>
      )}

      {/* 1. Linescore + boxscore (from the feed) */}
      {scored && !isDisrupted && (
        <Section title="Boxscore">
          <div className="space-y-4">
            <Linescore feed={feed} />
            <BoxscoreTables away={feed.boxscore.away} home={feed.boxscore.home} />
          </div>
        </Section>
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

      {/* 3. Head-to-head */}
      <Section title="Season series">
        <Suspense fallback={<SectionSkeleton />}>
          <HeadToHeadSection feed={feed} season={season} />
        </Suspense>
      </Section>

      {/* 4. Batter vs pitcher */}
      <Section title="Matchups">
        <Suspense fallback={<SectionSkeleton />}>
          <MatchupSection feed={feed} season={season} />
        </Suspense>
      </Section>

      {/* 5. Sabermetrics */}
      <Section title="Sabermetric evaluations">
        <Suspense fallback={<SectionSkeleton />}>
          <SaberSection feed={feed} season={season} />
        </Suspense>
      </Section>
    </div>
  );
}
