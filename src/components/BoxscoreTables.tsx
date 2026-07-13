import type { TeamBoxscore } from "@/lib/mlb/types";

const BAT_COLS = ["AB", "R", "H", "RBI", "BB", "K", "AVG"] as const;
const PIT_COLS = ["IP", "H", "R", "ER", "BB", "K", "ERA"] as const;

function Th({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <th
      scope="col"
      className={`px-2 py-1 font-medium text-neutral-500 ${first ? "text-left" : "text-right"}`}
    >
      {children}
    </th>
  );
}

function TeamBox({ box }: { box: TeamBoxscore }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{box.team.name}</h3>

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
            {box.batters.map((b) => (
              <tr
                key={b.id}
                className="border-t border-neutral-100 dark:border-neutral-800"
              >
                <td className="px-2 py-1 text-left">
                  {b.name}
                  <span className="ml-1 text-xs text-neutral-500">
                    {b.position}
                  </span>
                </td>
                <td className="px-2 py-1 text-right">{b.ab}</td>
                <td className="px-2 py-1 text-right">{b.r}</td>
                <td className="px-2 py-1 text-right">{b.h}</td>
                <td className="px-2 py-1 text-right">{b.rbi}</td>
                <td className="px-2 py-1 text-right">{b.bb}</td>
                <td className="px-2 py-1 text-right">{b.k}</td>
                <td className="px-2 py-1 text-right">{b.avg}</td>
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
                  className="border-t border-neutral-100 dark:border-neutral-800"
                >
                  <td className="px-2 py-1 text-left">{p.name}</td>
                  <td className="px-2 py-1 text-right">{p.ip}</td>
                  <td className="px-2 py-1 text-right">{p.h}</td>
                  <td className="px-2 py-1 text-right">{p.r}</td>
                  <td className="px-2 py-1 text-right">{p.er}</td>
                  <td className="px-2 py-1 text-right">{p.bb}</td>
                  <td className="px-2 py-1 text-right">{p.k}</td>
                  <td className="px-2 py-1 text-right">{p.era}</td>
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
}: {
  away: TeamBoxscore;
  home: TeamBoxscore;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TeamBox box={away} />
      <TeamBox box={home} />
    </div>
  );
}
