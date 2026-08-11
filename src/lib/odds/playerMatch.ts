import type { PlayerRef } from "@/lib/mlb/types";

/**
 * Normalizes a player name for cross-source matching: strips accents,
 * periods (so "J.D." and "JD" agree), hyphens (treated as a space so
 * "Jean-Segura" agrees with "Jean Segura"), and Jr./Sr./numeral suffixes,
 * then lowercases and collapses whitespace.
 */
export function normalizePlayerName(name: string): string {
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
 * Finds the roster entry whose name normalizes to the same string as
 * `oddsName`. No fuzzy/Levenshtein matching — an unmatched name returns
 * `null` rather than risking a wrong player attribution.
 */
export function matchPlayerName(
  oddsName: string,
  roster: PlayerRef[],
): PlayerRef | null {
  const target = normalizePlayerName(oddsName);
  return roster.find((p) => normalizePlayerName(p.fullName) === target) ?? null;
}
