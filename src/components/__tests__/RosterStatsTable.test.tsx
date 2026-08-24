import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RosterStatsTable from "../RosterStatsTable";

const K_RATES = ["10.0%", "20.0%", "30.0%", "40.0%", "50.0%"];

function classForCell(html: string, value: string): string {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<td class="([^"]*)">${escaped}</td>`));
  if (!match) throw new Error(`Could not find cell containing ${value}`);
  return match[1];
}

describe("RosterStatsTable quantile highlighting", () => {
  it("grades batter K% by team quantiles with lower rates better", () => {
    const hitters = K_RATES.map((kPct, index) => ({
      player: { id: index + 1, fullName: `Batter ${index + 1}` },
      position: "OF",
      stats: { kPct },
    }));

    const html = renderToStaticMarkup(
      <RosterStatsTable
        team={{ id: 135, name: "San Diego Padres" }}
        hitters={hitters}
        pitchers={[]}
      />,
    );

    expect(classForCell(html, "10.0%")).toContain("bg-hot/15");
    expect(classForCell(html, "30.0%")).not.toMatch(/bg-(?:hot|cold)\/15/);
    expect(classForCell(html, "50.0%")).toContain("bg-cold/15");
  });
});
