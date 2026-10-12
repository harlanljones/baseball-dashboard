/**
 * Memo for {@link normalizePlayerName}. A board repeats each player's name
 * across every market and side it posts, so the same string is normalized ten
 * or more times per player while matching a single game. The pipeline is pure,
 * so caching it changes nothing but the work; the map is cleared wholesale past
 * a bound rather than evicted per entry, so a provider posting unbounded names
 * cannot grow it without limit.
 */
const NORMALIZED = new Map<string, string>();
const NORMALIZED_LIMIT = 5000;

/**
 * Normalizes a player name for cross-source matching: strips accents,
 * periods (so "J.D." and "JD" agree), hyphens (treated as a space so
 * "Jean-Segura" agrees with "Jean Segura"), and Jr./Sr./numeral suffixes,
 * then lowercases and collapses whitespace.
 */
export function normalizePlayerName(name: string): string {
  const cached = NORMALIZED.get(name);
  if (cached !== undefined) return cached;
  const normalized = normalizeUncached(name);
  if (NORMALIZED.size >= NORMALIZED_LIMIT) NORMALIZED.clear();
  NORMALIZED.set(name, normalized);
  return normalized;
}

function normalizeUncached(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .replace(/\./g, "") // strip periods before hyphen handling, so "J.D." -> "JD"
    .replace(/-/g, " ")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/gi, "")
    .replace(/[^a-zA-Z\s]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalized-name index over a list of records, keyed by whichever field holds
 * the player's name.
 *
 * A prop board posts hundreds of names that all resolve against the same
 * roster, and a scan per name re-runs the normalization pipeline above against
 * every roster entry for every prop. Indexing once turns each lookup into a
 * single normalization of the incoming name plus a map hit.
 *
 * The first record with a given normalized name wins, which is the attribution
 * a first-match scan produces, so a roster holding two spellings of one name
 * resolves identically either way. Unmatched names are simply absent — no
 * fuzzy matching, so a name that normalizes differently stays unattributed
 * rather than being attached to the wrong player.
 */
export function indexByNormalizedName<T>(items: T[], nameOf: (item: T) => string): Map<string, T> {
  const byName = new Map<string, T>();
  for (const item of items) {
    const key = normalizePlayerName(nameOf(item));
    if (!byName.has(key)) byName.set(key, item);
  }
  return byName;
}
