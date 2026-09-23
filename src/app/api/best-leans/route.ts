import { getBestLeans } from "@/lib/odds/leans";

/**
 * The cross-slate leans, fetched by the landing page's leans section once it
 * scrolls into view. Keeping this off the document response is what stops a
 * provider-wide odds board and a prop lookup per game from gating first paint.
 *
 * A short browser TTL spares repeat views and back-navigations a round trip.
 * An empty list gets a shorter one: it is never cached server-side (a passing
 * odds failure must not stick), so it should not stick in the browser either.
 */
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  let leans: Awaited<ReturnType<typeof getBestLeans>>;
  try {
    leans = await getBestLeans(date);
  } catch {
    // Fail soft: the landing page treats an error the same as an empty slate.
    leans = [];
  }
  return Response.json(
    { leans },
    {
      headers: {
        "Cache-Control":
          leans.length > 0
            ? "public, max-age=60, stale-while-revalidate=300"
            : "public, max-age=15",
      },
    },
  );
}
