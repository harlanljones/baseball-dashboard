import { AsyncLocalStorage } from "node:async_hooks";

/**
 * One request's worth of shared odds lookups.
 *
 * The league-wide SportsGameOdds board is the same multi-megabyte payload for
 * every game on a slate, but each game used to fetch and parse it on its own:
 * once to resolve its event, once more to read its props. Next's fetch cache
 * keeps most of those off the provider, yet every call still reads the entry
 * back and parses it again — and on a cold cache, concurrent identical misses
 * are not merged, so a slate of eight games sent eight identical requests.
 *
 * Inside a scope, the first caller's promise is handed to every later caller
 * with the same key, so the board is fetched and parsed once per scope. The
 * scope is per request by construction ({@link withOddsScope} wraps one unit
 * of work), so nothing is shared across requests or outlives the data cache.
 */
const scope = new AsyncLocalStorage<Map<string, Promise<unknown>>>();

/**
 * Runs `fn` with a shared-lookup scope. Nested calls join the scope already
 * open, so a slate-wide caller and the per-game code it calls share one board.
 */
export function withOddsScope<T>(fn: () => Promise<T>): Promise<T> {
  return scope.getStore() ? fn() : scope.run(new Map(), fn);
}

/**
 * `load()`'s promise, shared with every caller using `key` in the current
 * scope. A rejection is shared too, the same failure every caller would have
 * hit on its own. Outside a scope this is just `load()`.
 */
export function shareInScope<T>(key: string, load: () => Promise<T>): Promise<T> {
  const store = scope.getStore();
  if (!store) return load();
  let pending = store.get(key) as Promise<T> | undefined;
  if (!pending) {
    pending = load();
    store.set(key, pending);
  }
  return pending;
}
