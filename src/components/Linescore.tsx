import type { GameFeed } from "@/lib/mlb/types";

function abbr(feed: GameFeed, side: "away" | "home"): string {
  const t = feed[side].team;
  return t.abbreviation ?? t.name;
}

function cell(v?: number): string {
  return v == null ? "" : String(v);
}

/** Spacer column setting the R/H/E totals off from the inning plates. */
function Gap({ header }: { header?: boolean }) {
  const cls = "w-2 p-0";
  return header ? <th aria-hidden className={cls} /> : <td aria-hidden className={cls} />;
}

export default function Linescore({ feed }: { feed: GameFeed }) {
  const { innings, away, home } = feed.linescore;
  if (innings.length === 0) return null;

  // The feed only lists innings that have started, so during a live game the
  // last entry is the inning in progress.
  const currentInning =
    feed.state === "Live" ? innings[innings.length - 1]?.num : undefined;

  return (
    <div className="overflow-x-auto rounded-md bg-field p-3 text-white shadow-sm">
      <table className="font-mono w-full min-w-max border-separate border-spacing-[3px] text-sm">
        <caption className="sr-only">
          Line score by inning: {abbr(feed, "away")} at {abbr(feed, "home")}
        </caption>
        <thead>
          <tr className="font-display text-xs">
            <th scope="col" className="px-2 py-0.5 text-left">
              <span className="sr-only">Team</span>
            </th>
            {innings.map((i) => (
              <th
                key={i.num}
                scope="col"
                className={`w-7 px-1 py-0.5 text-center font-semibold ${
                  i.num === currentInning ? "text-gold" : "text-white/60"
                }`}
              >
                {i.num}
              </th>
            ))}
            <Gap header />
            {["R", "H", "E"].map((h) => (
              <th
                key={h}
                scope="col"
                className="w-8 px-2 py-0.5 text-center font-semibold text-white/90"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(["away", "home"] as const).map((side) => {
            const totals = side === "away" ? away : home;
            return (
              <tr key={side}>
                <td className="font-display px-2 py-1 text-left font-semibold uppercase tracking-wider">
                  {abbr(feed, side)}
                </td>
                {innings.map((i) => (
                  <td
                    key={i.num}
                    className={`w-7 rounded-[3px] border bg-field-deep/50 px-1 py-1 text-center font-medium ${
                      i.num === currentInning
                        ? "border-gold/50 text-gold"
                        : "border-white/10"
                    }`}
                  >
                    {cell(i[side].runs)}
                  </td>
                ))}
                <Gap />
                <td className="w-8 rounded-[3px] bg-field-deep px-2 py-1 text-center font-semibold">
                  {cell(totals.runs)}
                </td>
                <td className="w-8 rounded-[3px] bg-field-deep px-2 py-1 text-center">
                  {cell(totals.hits)}
                </td>
                <td className="w-8 rounded-[3px] bg-field-deep px-2 py-1 text-center">
                  {cell(totals.errors)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
