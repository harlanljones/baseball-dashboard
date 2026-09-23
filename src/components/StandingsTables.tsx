import TeamLogo from "@/components/TeamLogo";
import type { DivisionStandings, StandingsRow } from "@/lib/mlb/types";

function diffText(diff: number | undefined): string {
  if (diff === undefined) return "-";
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

function DivisionTable({ division }: { division: DivisionStandings }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="eyebrow mb-2 text-left text-sm">{division.name}</caption>
      <thead>
        <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-wide text-ink/65">
          <th scope="col" className="py-1 pr-2 font-semibold">
            Team
          </th>
          <th scope="col" className="nums px-1 py-1 text-right font-semibold">
            W
          </th>
          <th scope="col" className="nums px-1 py-1 text-right font-semibold">
            L
          </th>
          <th scope="col" className="nums px-1 py-1 text-right font-semibold">
            PCT
          </th>
          <th scope="col" className="nums px-1 py-1 text-right font-semibold">
            GB
          </th>
          <th scope="col" className="nums py-1 pl-1 text-right font-semibold">
            DIFF
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-ink/10">
        {division.teams.map((row: StandingsRow) => (
          <tr key={row.team.id}>
            <th scope="row" className="py-1.5 pr-2 text-left font-normal">
              <span className="flex min-w-0 items-center gap-1.5">
                <TeamLogo teamId={row.team.id} size={18} />
                <span className="truncate">
                  {row.team.abbreviation ?? row.team.name}
                </span>
                {row.clinch && (
                  <span
                    aria-label={`clinched: ${row.clinch}`}
                    className="shrink-0 text-xs font-semibold text-ink/65"
                  >
                    {row.clinch}
                  </span>
                )}
              </span>
            </th>
            <td className="nums px-1 py-1.5 text-right">{row.wins}</td>
            <td className="nums px-1 py-1.5 text-right">{row.losses}</td>
            <td className="nums px-1 py-1.5 text-right">{row.pct}</td>
            <td className="nums px-1 py-1.5 text-right">{row.gamesBack}</td>
            <td className="nums py-1.5 pl-1 text-right">
              {diffText(row.runDifferential)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Six division tables (AL then NL) in a responsive grid, plus a clinch-code legend. */
export default function StandingsTables({
  divisions,
}: {
  season: number;
  divisions: DivisionStandings[];
}) {
  const ordered = [
    ...divisions.filter((d) => d.league === "AL"),
    ...divisions.filter((d) => d.league === "NL"),
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ordered.map((division) => (
          <div
            key={division.divisionId}
            className="rounded-md border border-ink/15 bg-card p-3 shadow-sm"
          >
            <DivisionTable division={division} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink/65">
        z best record in league · y division · w wild card · x playoff berth
      </p>
    </div>
  );
}
