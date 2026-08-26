import { getBestLeans } from "@/lib/odds/leans";

/**
 * The cross-slate leans, fetched by the landing page's leans section once it
 * scrolls into view. Keeping this off the document response is what stops a
 * provider-wide odds board and a prop lookup per game from gating first paint.
 */
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  try {
    return Response.json({ leans: await getBestLeans(date) });
  } catch {
    // Fail soft: the landing page treats an error the same as an empty slate.
    return Response.json({ leans: [] });
  }
}
