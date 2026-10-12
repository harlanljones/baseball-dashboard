import TeamLogo from "@/components/TeamLogo";
import type { DivisionStandings, StandingsRow } from "@/lib/mlb/types";

function diffText(diff: number | undefined): string {
  if (diff === undefined) return "-";
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

const CLINCH_LABEL: Record<string, string> = {
  z: "clinched best record in league",
  y: "clinched division",
  w: "clinched wild card",
  x: "clinched playoff berth",
};

function DivisionTable({ division }: { division: DivisionStandings }) {
  return (
    <div>
      <div aria-hidden className="eyebrow mb-2 text-sm">
        {division.name}
      </div>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{division.name}</caption>
        <thead>
          <tr className="border-b border-ink/15">
            <th scope="col" className="th-left">
              Team
            </th>
            <th scope="col" className={`nums th-right`}>
              W
            </th>
            <th scope="col" className={`nums th-right`}>
              L
            </th>
            <th scope="col" className={`nums th-right`}>
              PCT
            </th>
            <th scope="col" className={`nums th-right`}>
              GB
            </th>
            <th scope="col" className={`nums th-right`}>
              DIFF
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink/10">
          {division.teams.map((row: StandingsRow) => (
            <tr key={row.team.id}>
              <th scope="row" className={`td-left font-normal`}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <TeamLogo teamId={row.team.id} size={18} />
                  <span className="truncate">
                    {row.team.abbreviation ?? row.team.name}
                  </span>
                  {row.clinch && (
                    <span className="shrink-0 text-xs font-semibold text-ink/65">
                      {row.clinch}
                      <span className="sr-only">
                        {" "}
                        {CLINCH_LABEL[row.clinch] ?? `clinched: ${row.clinch}`}
                      </span>
                    </span>
                  )}
                </span>
              </th>
              <td className={`nums td-right`}>{row.wins}</td>
              <td className={`nums td-right`}>{row.losses}</td>
              <td className={`nums td-right`}>{row.pct}</td>
              <td className={`nums td-right`}>{row.gamesBack}</td>
              <td className={`nums td-right`}>{diffText(row.runDifferential)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
