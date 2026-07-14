import Link from "next/link";
import GameStatusBadge from "./GameStatusBadge";
import LocalTime from "./LocalTime";
import PlayerHeadshot from "./PlayerHeadshot";
import TeamLogo from "./TeamLogo";
import type { PlayerRef, ScheduleGame, ScheduleTeamSide } from "@/lib/mlb/types";

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
      className={`flex items-center justify-between gap-2 ${loser ? "text-ink/50" : ""}`}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="self-center">
          <TeamLogo teamId={side.team.id} size={20} />
        </span>
        <span className="font-display truncate text-lg font-semibold leading-tight">
          {side.team.name}
        </span>
        {recordText(side) && (
          <span className="nums shrink-0 text-xs text-ink/50">
            {recordText(side)}
          </span>
        )}
      </div>
      {showScore && (
        <span className="font-mono w-7 shrink-0 text-right text-lg font-semibold">
          {side.score ?? "-"}
        </span>
      )}
    </div>
  );
}

function ProbableRow({
  abbr,
  pitcher,
}: {
  abbr: string;
  pitcher?: PlayerRef;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {pitcher && <PlayerHeadshot personId={pitcher.id} size={18} />}
      <span className="shrink-0 text-ink/40">{abbr}</span>
      <span className="truncate">{pitcher?.fullName ?? "TBD"}</span>
    </span>
  );
}

export default function GameCard({ game }: { game: ScheduleGame }) {
  const scored = game.state === "Live" || game.state === "Final";
  const isFinal = game.state === "Final";
  const awayLost = isFinal && game.home.isWinner === true;
  const homeLost = isFinal && game.away.isWinner === true;

  const hasProbables =
    game.state === "Preview" &&
    Boolean(game.away.probablePitcher || game.home.probablePitcher);

  return (
    <Link
      href={`/games/${game.gamePk}`}
      className="block rounded-md border border-ink/10 bg-card p-4 shadow-sm transition hover:border-field/40 hover:shadow-md"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <GameStatusBadge game={game} />
        {game.state === "Preview" && (
          <span className="font-mono text-xs text-ink/60">
            <LocalTime iso={game.gameDate} />
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <TeamRow side={game.away} showScore={scored} loser={awayLost} />
        <TeamRow side={game.home} showScore={scored} loser={homeLost} />
      </div>

      {(hasProbables || game.venue) && (
        <div className="mt-3 space-y-1 border-t border-ink/10 pt-2 text-xs text-ink/60">
          {hasProbables && (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <ProbableRow
                abbr={game.away.team.abbreviation ?? "Away"}
                pitcher={game.away.probablePitcher}
              />
              <ProbableRow
                abbr={game.home.team.abbreviation ?? "Home"}
                pitcher={game.home.probablePitcher}
              />
            </div>
          )}
          {game.venue && (
            <p className="truncate">
              {[game.venue, game.venueCity].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}
