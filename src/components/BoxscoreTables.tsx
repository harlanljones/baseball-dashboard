import TeamLogo from "./TeamLogo";
import StatGradeLegend from "./StatGradeLegend";
import { statClass } from "@/lib/statColor";
import type { TeamBoxscore } from "@/lib/mlb/types";

const BAT_COLS = ["AB", "R", "H", "RBI", "BB", "K", "AVG"] as const;
const PIT_COLS = ["IP", "H", "R", "ER", "BB", "K", "ERA"] as const;

function Th({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <th
      scope="col"
      className={`font-display px-2 py-1 text-xs font-semibold uppercase tracking-wider text-ink/65 ${first ? "text-left" : "text-right"}`}
    >
      {children}
    </th>
  );
}

function TeamBox({ box, isLive }: { box: TeamBoxscore; isLive?: boolean }) {
  // When game is live, exclude pitchers from batting table
  const displayBatters = isLive
    ? box.batters.filter((b) => !box.pitcherIds.includes(b.id))
    : box.batters;

  // min-w-0 lets the overflow-x-auto tables scroll instead of stretching the grid column.
  return (
    <div className="min-w-0">
      <h3 className="font-display mb-2 flex items-center gap-2 text-base font-semibold">
        <TeamLogo teamId={box.team.id} size={18} />
        {box.team.name}
      </h3>

      <div className="overflow-x-auto">
        <table className="nums w-full min-w-max text-sm">
          <caption className="sr-only">{box.team.name} batting</caption>
          <thead>
            <tr>
              <Th first>Batters</Th>
              {BAT_COLS.map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayBatters.map((b) => (
              <tr
                key={b.id}
                className="border-t border-ink/10"
              >
                <td className="px-2 py-1 text-left">
                  {b.name}
                  <span className="ml-1 text-xs text-ink/65">
                    {b.position}
                  </span>
                </td>
                <td className="font-mono px-2 py-1 text-right">{b.ab}</td>
                <td className="font-mono px-2 py-1 text-right">{b.r}</td>
                <td className="font-mono px-2 py-1 text-right">{b.h}</td>
                <td className="font-mono px-2 py-1 text-right">{b.rbi}</td>
                <td className="font-mono px-2 py-1 text-right">{b.bb}</td>
                <td className="font-mono px-2 py-1 text-right">{b.k}</td>
                <td className={`font-mono px-2 py-1 text-right ${statClass("avg", b.avg)}`}>
                  {b.avg}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {box.pitchers.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="nums w-full min-w-max text-sm">
            <caption className="sr-only">{box.team.name} pitching</caption>
            <thead>
              <tr>
                <Th first>Pitchers</Th>
                {PIT_COLS.map((c) => (
                  <Th key={c}>{c}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {box.pitchers.map((p) => (
                <tr
                  key={p.id}
                  className="border-t border-ink/10"
                >
                  <td className="px-2 py-1 text-left">{p.name}</td>
                  <td className="font-mono px-2 py-1 text-right">{p.ip}</td>
                  <td className="font-mono px-2 py-1 text-right">{p.h}</td>
                  <td className="font-mono px-2 py-1 text-right">{p.r}</td>
                  <td className="font-mono px-2 py-1 text-right">{p.er}</td>
                  <td className="font-mono px-2 py-1 text-right">{p.bb}</td>
                  <td className="font-mono px-2 py-1 text-right">{p.k}</td>
                  <td className={`font-mono px-2 py-1 text-right ${statClass("era", p.era)}`}>
                    {p.era}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function BoxscoreTables({
  away,
  home,
  isLive,
}: {
  away: TeamBoxscore;
  home: TeamBoxscore;
  isLive?: boolean;
}) {
  return (
    <div>
      <StatGradeLegend className="mb-4" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TeamBox box={away} isLive={isLive} />
        <TeamBox box={home} isLive={isLive} />
      </div>
    </div>
  );
}
