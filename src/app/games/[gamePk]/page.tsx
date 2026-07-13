import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import AutoRefresh from "@/components/AutoRefresh";
import BoxscoreTables from "@/components/BoxscoreTables";
import GameStatusBadge from "@/components/GameStatusBadge";
import HeadToHead from "@/components/HeadToHead";
import Linescore from "@/components/Linescore";
import MatchupTable from "@/components/MatchupTable";
import SaberCard, { type SaberStat } from "@/components/SaberCard";

import { easternToday, MlbApiError } from "@/lib/mlb/client";
import { getLiveFeed } from "@/lib/mlb/game";
import {
  buildMatchups,
  lineupFor,
  startingPitcherFor,
} from "@/lib/mlb/matchup";
import { getSaberHitting, getSaberPitching } from "@/lib/mlb/players";
import { getHeadToHead } from "@/lib/mlb/schedule";
import type { GameFeed, PlayerRef, SaberHitting } from "@/lib/mlb/types";

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
    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
      Couldn’t load {label} right now.
    </p>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SectionSkeleton() {
  return (
    <div className="h-24 animate-pulse rounded bg-neutral-100 dark:bg-neutral-800" />
  );
}

function formatFirstPitch(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

// --- async sections ----------------------------------------------------------

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
    { label: "wOBA", value: rate3(s?.woba) },
    { label: "wRC+", value: int(s?.wrcPlus) },
    { label: "WAR", value: dec1(s?.war) },
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
    <div>
      <h3 className="mb-2 text-sm font-semibold">{team.name}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pitcher && (
          <SaberCard
            name={pitcher.fullName}
            subtitle="Starting pitcher"
            stats={[
              { label: "WAR", value: dec1(pitchingStats?.war) },
              { label: "FIP", value: dec2(pitchingStats?.fip) },
              { label: "xFIP", value: dec2(pitchingStats?.xfip) },
              { label: "ERA-", value: int(pitchingStats?.eraMinus) },
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
        <p className="mt-2 text-xs text-neutral-500">
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
        className="inline-block text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        ← All games
      </Link>

      {/* Header */}
      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-3 flex items-center justify-between">
          <GameStatusBadge game={{ state: feed.state, detailedState: feed.detailedState }} />
          {isPreview && feed.startTime && (
            <span className="text-sm text-neutral-500">
              {formatFirstPitch(feed.startTime)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-lg">
          <span className="font-medium">{feed.away.team.name}</span>
          {scored && (
            <span className="nums font-semibold">{feed.away.score ?? "-"}</span>
          )}
        </div>
        <div className="flex items-center justify-between text-lg">
          <span className="font-medium">{feed.home.team.name}</span>
          {scored && (
            <span className="nums font-semibold">{feed.home.score ?? "-"}</span>
          )}
        </div>

        {feed.state === "Final" && (d?.winner || d?.loser) && (
          <p className="mt-3 border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
            {d?.winner && <>W: {d.winner.fullName}</>}
            {d?.loser && <> · L: {d.loser.fullName}</>}
            {d?.save && <> · SV: {d.save.fullName}</>}
          </p>
        )}

        {isPreview && (feed.probablePitchers.away || feed.probablePitchers.home) && (
          <p className="mt-3 border-t border-neutral-100 pt-2 text-sm text-neutral-500 dark:border-neutral-800">
            Probables:{" "}
            {feed.probablePitchers.away
              ? `${teamName(feed.away.team)} ${feed.probablePitchers.away.fullName}`
              : `${teamName(feed.away.team)} TBD`}
            {" · "}
            {feed.probablePitchers.home
              ? `${teamName(feed.home.team)} ${feed.probablePitchers.home.fullName}`
              : `${teamName(feed.home.team)} TBD`}
          </p>
        )}
      </div>

      {isDisrupted && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
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

      {/* 2. Head-to-head */}
      <Section title="Season series">
        <Suspense fallback={<SectionSkeleton />}>
          <HeadToHeadSection feed={feed} season={season} />
        </Suspense>
      </Section>

      {/* 3. Batter vs pitcher */}
      <Section title="Matchups">
        <Suspense fallback={<SectionSkeleton />}>
          <MatchupSection feed={feed} season={season} />
        </Suspense>
      </Section>

      {/* 4. Sabermetrics */}
      <Section title="Sabermetric evaluations">
        <Suspense fallback={<SectionSkeleton />}>
          <SaberSection feed={feed} season={season} />
        </Suspense>
      </Section>
    </div>
  );
}
