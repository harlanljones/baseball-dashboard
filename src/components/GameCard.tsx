import Link from "next/link";
import GameStatusBadge from "./GameStatusBadge";
import LocalTime from "./LocalTime";
import type { ScheduleGame, ScheduleTeamSide } from "@/lib/mlb/types";

function recordText(side: ScheduleTeamSide): string {
  return side.record ? `${side.record.wins}-${side.record.losses}` : "";
}

function TeamRow({
  side,
  showScore,
  loser,
}: {
  side: ScheduleTeamSide;
  showScore: boolean;
  loser: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${loser ? "text-neutral-500" : ""}`}
    >
      <div className="flex items-baseline gap-2 truncate">
        <span className="truncate font-medium">{side.team.name}</span>
        {recordText(side) && (
          <span className="shrink-0 text-xs text-neutral-500">
            {recordText(side)}
          </span>
        )}
      </div>
      {showScore && (
        <span className="nums w-6 text-right text-lg font-semibold">
          {side.score ?? "-"}
        </span>
      )}
    </div>
  );
}

export default function GameCard({ game }: { game: ScheduleGame }) {
  const scored = game.state === "Live" || game.state === "Final";
  const isFinal = game.state === "Final";
  const awayLost = isFinal && game.home.isWinner === true;
  const homeLost = isFinal && game.away.isWinner === true;

  const probables =
    game.away.probablePitcher || game.home.probablePitcher
      ? [
          game.away.probablePitcher &&
            `${game.away.team.abbreviation ?? "Away"}: ${game.away.probablePitcher.fullName}`,
          game.home.probablePitcher &&
            `${game.home.team.abbreviation ?? "Home"}: ${game.home.probablePitcher.fullName}`,
        ]
          .filter(Boolean)
          .join("  ·  ")
      : null;

  return (
    <Link
      href={`/games/${game.gamePk}`}
      className="block rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
    >
      <div className="mb-2 flex items-center justify-between">
        <GameStatusBadge game={game} />
        {game.state === "Preview" && (
          <span className="text-xs text-neutral-500">
            <LocalTime iso={game.gameDate} />
          </span>
        )}
      </div>

      <div className="space-y-1">
        <TeamRow side={game.away} showScore={scored} loser={awayLost} />
        <TeamRow side={game.home} showScore={scored} loser={homeLost} />
      </div>

      {game.state === "Preview" && probables && (
        <p className="mt-3 truncate border-t border-neutral-100 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
          {probables}
        </p>
      )}
    </Link>
  );
}
