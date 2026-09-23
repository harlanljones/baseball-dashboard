/**
 * The odds layer is fail-soft: every provider failure resolves to an empty
 * board rather than an error page. That hides the cause, so each swallowed
 * failure is logged here first. On Cloudflare Workers these land in Workers
 * Logs (observability is enabled in wrangler.jsonc), which is where a rate
 * limit or a spent quota shows up.
 */
export function logOddsFailure(context: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  console.warn(`[odds] ${context}: ${detail}`);
}

/**
 * The provider's own explanation from an error body, when it has one: The
 * Odds API sends `{ message }`, SportsGameOdds sends `{ error }`.
 */
export function upstreamMessage(body: unknown): string | null {
  if (body == null || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const text = typeof o.message === "string" ? o.message : typeof o.error === "string" ? o.error : null;
  return text?.trim() || null;
}
