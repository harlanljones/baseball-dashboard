import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HeadToHead from "../HeadToHead";
import type { HeadToHead as HeadToHeadData, SeriesMeeting } from "@/lib/mlb/types";

const NYY = { id: 147, name: "New York Yankees", abbreviation: "NYY" };
const BOS = { id: 111, name: "Boston Red Sox", abbreviation: "BOS" };

function meeting(gamePk: number, date: string, nyy: number, bos: number): SeriesMeeting {
  return {
    gamePk,
    date,
    state: "Final",
    away: { team: BOS, score: bos },
    home: { team: NYY, score: nyy },
  };
}

const regular: HeadToHeadData = {
  teamA: NYY,
  teamB: BOS,
  aWins: 1,
  bWins: 2,
  meetings: [
    meeting(1, "2026-05-01T23:00:00Z", 1, 4),
    meeting(2, "2026-05-02T23:00:00Z", 5, 3),
    meeting(3, "2026-05-03T23:00:00Z", 0, 2),
  ],
};

describe("HeadToHead", () => {
  it("shows only the season series for a regular-season game", () => {
    const html = renderToStaticMarkup(<HeadToHead h2h={regular} />);
    expect(html).toContain("BOS lead the season series 2–1.");
    expect(html).not.toContain("Regular season");
  });

  it("leads with the postseason round, then the regular season", () => {
    const html = renderToStaticMarkup(
      <HeadToHead
        h2h={{
          ...regular,
          postseason: {
            gameType: "D",
            name: "Division Series",
            aWins: 2,
            bWins: 0,
            meetings: [
              meeting(10, "2026-10-04T23:00:00Z", 6, 2),
              meeting(11, "2026-10-05T23:00:00Z", 3, 1),
            ],
          },
        }}
      />,
    );

    const postseasonAt = html.indexOf("NYY lead the Division Series 2–0.");
    const regularAt = html.indexOf("BOS lead the season series 2–1.");
    expect(postseasonAt).toBeGreaterThanOrEqual(0);
    expect(regularAt).toBeGreaterThan(postseasonAt);
    expect(html).toContain("/games/10");
    expect(html).toContain('href="/games/1"');
  });

  it("says when a postseason round has no completed games", () => {
    const html = renderToStaticMarkup(
      <HeadToHead
        h2h={{
          ...regular,
          postseason: { gameType: "W", name: "World Series", aWins: 0, bWins: 0, meetings: [] },
        }}
      />,
    );
    expect(html).toContain("No completed games yet in the World Series.");
  });
});
