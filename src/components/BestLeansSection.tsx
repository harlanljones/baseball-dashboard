"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PlayerHeadshot from "./PlayerHeadshot";
import { LeansHeader, LeansRowBlock } from "./BestLeansSkeleton";
import { MARKET_LABELS } from "@/lib/odds/board";
import type { SlateLean } from "@/lib/odds/leans";

/** Start fetching a little before the plate reaches the viewport. */
const ROOT_MARGIN = "200px";

function formatPrice(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function DirectionChip({ direction }: { direction: "over" | "under" }) {
  return (
    <span className="rounded-sm border border-ink/25 px-1 py-px text-xs font-semibold uppercase tracking-wider text-ink/75">
      {direction}
    </span>
  );
}

type State =
  | { status: "pending" }
  | { status: "ready"; leans: SlateLean[] };

/**
 * The strongest leans across the slate, loaded when the plate scrolls into
 * view rather than with the page.
 *
 * The data behind this list costs a provider-wide odds board plus a prop
 * lookup per game — seconds of work for a section the visitor may never reach.
 * Deferring it keeps that off the document entirely, so the games grid is not
 * merely first to paint but the only thing the response waits for.
 *
 * The plate holds its full height from the first frame in every state, so the
 * grid below never moves when the leans land.
 */
export default function BestLeansSection({ date }: { date?: string }) {
  const [state, setState] = useState<State>({ status: "pending" });
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/best-leans${date ? `?date=${encodeURIComponent(date)}` : ""}`,
        );
        const data = (await res.json()) as { leans?: SlateLean[] };
        if (!cancelled) setState({ status: "ready", leans: data.leans ?? [] });
      } catch {
        if (!cancelled) setState({ status: "ready", leans: [] });
      }
    };

    // No IntersectionObserver (or an already-visible plate) simply loads now.
    if (typeof IntersectionObserver === "undefined") {
      void load();
      return () => {
        cancelled = true;
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      },
      { rootMargin: ROOT_MARGIN },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [date]);

  if (state.status === "pending") {
    return (
      <section
        ref={ref}
        role="status"
        className="mb-5 rounded-md border border-ink/10 bg-card p-4 shadow-sm"
      >
        <LeansHeader note="Reading the slate…" />
        <span className="sr-only">Loading best leans across the slate</span>
        <LeansRowBlock className="animate-pulse" />
      </section>
    );
  }

  if (state.leans.length === 0) {
    // The plate keeps the height it reserved — mounting the same row block
    // invisibly is what holds it, so the games grid never jumps. Only the rows
    // go invisible: the block's rules stay, so an odds-less slate reads as an
    // empty plate on the board rather than as a gap where a section failed.
    return (
      <section
        ref={ref}
        className="fade-in mb-5 rounded-md border border-dashed border-ink/20 bg-card p-4"
      >
        <LeansHeader note="Research signals only" />
        <div className="relative">
          <LeansRowBlock className="[&>*]:invisible" />
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink/65">
            No scored leans today — player-prop odds may be unavailable, or no edge
            clears the default weights.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="fade-in mb-5 rounded-md border border-ink/10 bg-card p-4 shadow-sm"
    >
      <LeansHeader note="Research signals only" />
      <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
        {state.leans.map((lean) => (
          <Link
            key={`${lean.gamePk}-${lean.playerId}-${lean.marketKey}-${lean.line}`}
            href={`/games/${lean.gamePk}/props#${lean.anchor}`}
            className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-1 py-3 hover:bg-paper"
          >
            <PlayerHeadshot personId={lean.playerId} size={28} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-display font-semibold">{lean.playerName}</span>
                <span className="text-xs text-ink/65">{lean.matchup}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs">
                <DirectionChip direction={lean.direction} />
                <span className="text-ink/75">
                  {MARKET_LABELS[lean.marketKey]} {lean.line}
                </span>
                <span className="nums font-mono text-ink/65">
                  {formatPrice(lean.price)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="nums font-mono text-lg font-semibold text-gold-deep">
                {lean.score.toFixed(1)}
              </span>
              <span
                aria-hidden
                className="text-ink/35 transition-transform group-hover:translate-x-0.5"
              >
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
