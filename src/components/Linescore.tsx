import type { GameFeed } from "@/lib/mlb/types";

function abbr(feed: GameFeed, side: "away" | "home"): string {
  const t = feed[side].team;
  return t.abbreviation ?? t.name;
}

function cell(v?: number): string {
  return v == null ? "" : String(v);
}

export default function Linescore({ feed }: { feed: GameFeed }) {
  const { innings, away, home } = feed.linescore;
  if (innings.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="nums w-full min-w-max text-sm">
        <caption className="sr-only">
          Line score by inning: {abbr(feed, "away")} at {abbr(feed, "home")}
        </caption>
        <thead>
          <tr className="text-neutral-500">
            <th scope="col" className="px-2 py-1 text-left font-medium">
              <span className="sr-only">Team</span>
            </th>
            {innings.map((i) => (
              <th
                key={i.num}
                scope="col"
                className="w-7 px-1 py-1 text-center font-medium"
              >
                {i.num}
              </th>
            ))}
            <th scope="col" className="w-8 px-2 py-1 text-center font-semibold">
              R
            </th>
            <th scope="col" className="w-8 px-2 py-1 text-center font-semibold">
              H
            </th>
            <th scope="col" className="w-8 px-2 py-1 text-center font-semibold">
              E
            </th>
          </tr>
        </thead>
        <tbody>
          {(["away", "home"] as const).map((side) => {
            const totals = side === "away" ? away : home;
            return (
              <tr
                key={side}
                className="border-t border-neutral-100 dark:border-neutral-800"
              >
                <td className="px-2 py-1 text-left font-medium">
                  {abbr(feed, side)}
                </td>
                {innings.map((i) => (
                  <td key={i.num} className="px-1 py-1 text-center">
                    {cell(i[side].runs)}
                  </td>
                ))}
                <td className="px-2 py-1 text-center font-semibold">
                  {cell(totals.runs)}
                </td>
                <td className="px-2 py-1 text-center">{cell(totals.hits)}</td>
                <td className="px-2 py-1 text-center">{cell(totals.errors)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
