import type { GameState, ScheduleGame } from "@/lib/mlb/types";

const STYLES: Record<GameState, string> = {
  Live: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 ring-1 ring-red-500/30",
  Final:
    "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  Preview:
    "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 ring-1 ring-sky-500/20",
  Other:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 ring-1 ring-amber-500/20",
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[game.state]}`}
    >
      {isLive && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"
        />
      )}
      {label(game)}
    </span>
  );
}
