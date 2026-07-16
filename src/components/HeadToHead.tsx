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

/**
 * Per-row result relative to `teamA` (fixed across the series, unlike
 * home/away which can flip meeting to meeting) plus the running record
 * through that row — computed while iterating chronologically since a
 * running tally only makes sense built up in order.
 */
interface SeriesRow {
  meeting: SeriesMeeting;
  /** true = teamA won, false = teamB won, null = not yet decided. */
  teamAWon: boolean | null;
  /** Cumulative aWins-bWins through this row. */
  record: string;
}

function buildRows(h2h: HeadToHeadData): SeriesRow[] {
  const meetings = [...h2h.meetings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let aTally = 0;
  let bTally = 0;
  return meetings.map((m) => {
    let teamAWon: boolean | null = null;
    if (m.state === "Final" && m.away.score != null && m.home.score != null) {
      const aIsAway = m.away.team.id === h2h.teamA.id;
      const aScore = aIsAway ? m.away.score : m.home.score;
      const bScore = aIsAway ? m.home.score : m.away.score;
      if (aScore !== bScore) {
        teamAWon = aScore > bScore;
        if (teamAWon) aTally++;
        else bTally++;
      }
    }
    return { meeting: m, teamAWon, record: `${aTally}-${bTally}` };
  });
}

export default function HeadToHead({ h2h }: { h2h: HeadToHeadData }) {
  const rows = buildRows(h2h);

  return (
    <div>
      <p className="mb-3 text-sm text-ink/70">{seriesSummary(h2h)}</p>

      {rows.length > 0 && (
        <div className="min-w-0 overflow-x-auto">
          <table className="nums w-full min-w-max text-sm">
            <caption className="sr-only">
              Season series between {name(h2h.teamA)} and {name(h2h.teamB)}, running record for{" "}
              {name(h2h.teamA)}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50">
                  Date
                </th>
                <th scope="col" className="font-display px-2 py-1 text-left text-xs font-semibold uppercase tracking-wider text-ink/50">
                  Matchup
                </th>
                <th scope="col" className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">
                  Score
                </th>
                <th scope="col" className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50">
                  Result
                </th>
                <th
                  scope="col"
                  title={`Running record for ${name(h2h.teamA)}`}
                  className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50"
                >
                  {name(h2h.teamA)} record
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ meeting: m, teamAWon, record }) => {
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
                  <tr key={m.gamePk} className="border-t border-ink/10 odd:bg-ink/5">
                    <td className="px-2 py-1 text-left">
                      <Link href={`/games/${m.gamePk}`} className="text-ink/50 hover:text-grass hover:underline">
                        {formatDate(m.date)}
                      </Link>
                    </td>
                    <td className="px-2 py-1 text-left">
                      <Link href={`/games/${m.gamePk}`} className="flex min-w-0 items-center gap-1.5 hover:text-grass">
                        <TeamMini team={m.away.team} lost={awayLost} />
                        <span className="shrink-0 text-ink/40">@</span>
                        <TeamMini team={m.home.team} lost={homeLost} />
                      </Link>
                    </td>
                    <td
                      className={`font-mono px-2 py-1 text-right ${isFinal ? "font-semibold" : "text-ink/50"}`}
                    >
                      {scoreText(m)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {teamAWon == null ? (
                        <span className="text-ink/40">–</span>
                      ) : (
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded font-mono text-xs font-semibold ${
                            teamAWon ? "bg-grass/15 text-grass" : "text-ink/40"
                          }`}
                        >
                          {teamAWon ? "W" : "L"}
                        </span>
                      )}
                    </td>
                    <td className="font-mono px-2 py-1 text-right text-ink/70">{record}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
