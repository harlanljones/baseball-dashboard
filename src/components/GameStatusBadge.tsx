import type { GameState, ScheduleGame } from "@/lib/mlb/types";

const STYLES: Record<GameState, string> = {
  Live: "bg-gold text-field-deep",
  Final: "bg-field/10 text-grass",
  Preview: "border border-ink/20 text-ink/75",
  // Disruptions are schedule facts, not failures — clay stays reserved for errors.
  Other: "border border-ink/25 text-ink/75",
};

function label(game: Pick<ScheduleGame, "state" | "detailedState" | "inning">): string {
  if (game.state === "Live") {
    const { state, ordinal } = game.inning ?? {};
    if (state && ordinal) return `${state} ${ordinal}`;
    return "Live";
  }
  return game.detailedState || game.state;
}

export default function GameStatusBadge({
  game,
}: {
  game: Pick<ScheduleGame, "state" | "detailedState" | "inning">;
}) {
  const isLive = game.state === "Live";
  return (
    <span
      className={`font-display inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${STYLES[game.state]}`}
    >
      {isLive && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-field-deep"
        />
      )}
      {label(game)}
    </span>
  );
}
