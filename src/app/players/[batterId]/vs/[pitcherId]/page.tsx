import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PageContainer from "@/components/PageContainer";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import VsPitcherLog from "@/components/VsPitcherLog";

import { easternToday } from "@/lib/mlb/client";
import { getPerson, getVsPlayer, getVsPlayerSeasons } from "@/lib/mlb/players";
import type { PlayerRef } from "@/lib/mlb/types";

// Head-to-head history changes at most as often as its underlying stats
// (TTL.playerStats, 6h), so render each pairing once and serve it from the
// incremental cache afterwards (ISR) instead of re-rendering per request.
// Full SSR on every request exceeds the Workers free-plan 10ms CPU budget
// when crawlers fan out across many matchup links at once.
export const revalidate = 21600;

// An empty param list means nothing is prerendered at build time; every
// pairing is instead rendered the first time it is visited and cached until
// `revalidate` elapses (see generateStaticParams docs, "All paths at runtime").
export function generateStaticParams() {
  return [];
}

function seasonsBack(count: number): number[] {
  const current = Number(easternToday().slice(0, 4));
  return Array.from({ length: count }, (_, i) => current - i);
}

function parseIds(batterId: string, pitcherId: string): [number, number] | null {
  const b = Number(batterId);
  const p = Number(pitcherId);
  if (!Number.isInteger(b) || b <= 0 || !Number.isInteger(p) || p <= 0) return null;
  return [b, p];
}

async function loadPlayers(
  batterId: string,
  pitcherId: string,
): Promise<{ batter: PlayerRef; pitcher: PlayerRef } | null> {
  const ids = parseIds(batterId, pitcherId);
  if (!ids) return null;
  const [batterIdNum, pitcherIdNum] = ids;
  const [batter, pitcher] = await Promise.all([
    getPerson(batterIdNum),
    getPerson(pitcherIdNum),
  ]);
  if (!batter || !pitcher) return null;
  return { batter, pitcher };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ batterId: string; pitcherId: string }>;
}): Promise<Metadata> {
  const { batterId, pitcherId } = await params;
  // Shares the page's fetch via per-request memoization — no extra API call.
  const players = await loadPlayers(batterId, pitcherId);
  if (!players) return { title: "Player not found" };
  return {
    title: `${players.batter.fullName} vs ${players.pitcher.fullName}`,
    description: `Season-by-season history for ${players.batter.fullName} against ${players.pitcher.fullName}.`,
  };
}

export default async function VsPitcherPage({
  params,
}: {
  params: Promise<{ batterId: string; pitcherId: string }>;
}) {
  const { batterId, pitcherId } = await params;
  const players = await loadPlayers(batterId, pitcherId);
  if (!players) notFound();
  const { batter, pitcher } = players;

  const [career, seasons] = await Promise.all([
    getVsPlayer(batter, pitcher),
    getVsPlayerSeasons(batter, pitcher, seasonsBack(10)),
  ]);

  return (
    <PageContainer>
      <div className="space-y-5">
        <Link
          href="/"
          className="inline-block text-sm text-ink/60 hover:text-ink"
        >
          ← All games
        </Link>

        <div className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
          <h1 className="font-display flex flex-wrap items-center gap-2 text-xl font-semibold">
            <PlayerHeadshot personId={batter.id} size={28} />
            {batter.fullName}
            <span className="font-normal text-ink/40">vs</span>
            <PlayerHeadshot personId={pitcher.id} size={28} />
            {pitcher.fullName}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            Season-by-season history — the MLB Stats API has no per-plate-appearance
            log against a single pitcher, so each row is one season&rsquo;s totals.
          </p>
        </div>

        <section className="rounded-md border border-ink/10 bg-card p-4 shadow-sm">
          <VsPitcherLog career={career} seasons={seasons} />
        </section>
      </div>
    </PageContainer>
  );
}
