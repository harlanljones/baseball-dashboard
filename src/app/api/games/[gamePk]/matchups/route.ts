import { MlbApiError } from "@/lib/mlb/client";
import { getLiveFeed, seasonOf } from "@/lib/mlb/game";
import { buildMatchups } from "@/lib/mlb/matchup";

/**
 * Batter-vs-pitcher matchup tables for one game.
 *
 * Served separately from the page render so its upstream fan-out gets a
 * dedicated Workers invocation — the game page's own render already spends
 * close to the platform's per-invocation subrequest budget, which is what
 * knocked this section out when it streamed inline.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ gamePk: string }> },
) {
  const { gamePk } = await params;
  const id = Number(gamePk);
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid gamePk" }, { status: 400 });
  }

  try {
    const feed = await getLiveFeed(id);
    const matchups = await buildMatchups(feed, seasonOf(feed));
    return Response.json(matchups, {
      headers: {
        // Matchup history is career-based; a short browser TTL trims
        // repeat invocations without hiding lineup postings for long.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    if (e instanceof MlbApiError && e.status === 404) {
      return Response.json({ error: "Game not found" }, { status: 404 });
    }
    return Response.json({ error: "Upstream MLB API failure" }, { status: 502 });
  }
}
