import Link from "next/link";
import TeamLogo from "./TeamLogo";
import type { HeadToHead as HeadToHeadData, SeriesMeeting, TeamRef } from "@/lib/mlb/types";

function name(t: { abbreviation?: string; name: string }): string {
  return t.abbreviation ?? t.name;
}

function seriesSummary(h2h: HeadToHeadData): string {
  const { teamA, teamB, aWins, bWins } = h2h;
  if (aWins === 0 && bWins === 0) return "No completed meetings yet this season.";
  if (aWins === bWins) return `Series tied ${aWins}–${bWins}.`;
  const leader = aWins > bWins ? teamA : teamB;
  const hi = Math.max(aWins, bWins);
  const lo = Math.min(aWins, bWins);
  return `${name(leader)} lead the season series ${hi}–${lo}.`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function TeamMini({ team, lost }: { team: TeamRef; lost: boolean }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 ${lost ? "text-ink/50" : "font-medium"}`}
    >
      <TeamLogo teamId={team.id} size={16} />
      <span className="truncate">{name(team)}</span>
    </span>
  );
}

function scoreText(m: SeriesMeeting): string {
  if (m.state === "Final") return `${m.away.score ?? "-"}–${m.home.score ?? "-"}`;
  return m.state === "Live" ? "Live" : "—";
}

export default function HeadToHead({ h2h }: { h2h: HeadToHeadData }) {
  const meetings = [...h2h.meetings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div>
      <p className="mb-3 text-sm text-ink/70">{seriesSummary(h2h)}</p>

      {meetings.length > 0 && (
        <ul className="divide-y divide-ink/10">
          {meetings.map((m) => {
            const isFinal = m.state === "Final";
            const awayLost =
              isFinal && m.away.score != null && m.home.score != null
                ? m.home.score > m.away.score
                : false;
            const homeLost =
              isFinal && m.away.score != null && m.home.score != null
                ? m.away.score > m.home.score
                : false;
            return (
              <li
                key={m.gamePk}
                className="odd:bg-ink/5"
              >
                <Link
                  href={`/games/${m.gamePk}`}
                  className="flex items-center gap-3 px-2 py-2 text-sm hover:text-grass"
                >
                  <span className="w-14 shrink-0 text-ink/50">
                    {formatDate(m.date)}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <TeamMini team={m.away.team} lost={awayLost} />
                    <span className="shrink-0 text-ink/40">@</span>
                    <TeamMini team={m.home.team} lost={homeLost} />
                  </span>
                  <span
                    className={`font-mono shrink-0 text-xs ${isFinal ? "font-semibold" : "text-ink/50"}`}
                  >
                    {scoreText(m)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
