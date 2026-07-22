# Player props sidebar — design spec

Date: 2026-07-22

## Purpose

Add a sidebar to the game detail page (`src/app/games/[gamePk]/page.tsx`) showing
sportsbook player props for that game, with each prop highlighted (over/under
lean) based on the player's season stats and, for power-related markets, the
ballpark weather report already computed for that game.

## Scope

- Game detail page only. No changes to the schedule/home page.
- Preview (pre-game) state only. Sportsbooks pull/suspend lines once a game
  goes live, so showing stale pre-game lines during a Live game would be
  misleading — the sidebar renders nothing once `feed.state !== "Preview"`.
- Players covered: both probable starting pitchers, plus each team's likely
  batting order. For Preview games the real batting order isn't posted yet, so
  batters are the same PA-sorted active-roster proxy the roster stats section
  already uses (`getRosterWithSeasonStats`).
- Markets: `pitcher_strikeouts`, `pitcher_outs`, `batter_hits`,
  `batter_total_bases`, `batter_home_runs`, `batter_rbis`, `batter_walks`.

## Data source

**The Odds API** (`api.the-odds-api.com`), free tier. Same shape as every other
external integration in this codebase: a thin fetch wrapper with its own TTL
cache, no persistence.

New env var: `ODDS_API_KEY`. No `.env.example` currently exists in this repo —
one will be added listing this key. If the key is unset, or the API has no
event/props for this specific matchup (common on the free tier for low-profile
games), the sidebar renders a quiet "No props available for this game" state.
This must never block or degrade the rest of the page — same `safe()` /
`Promise.allSettled` resilience pattern used by the existing async sections.

## New modules — `src/lib/odds/`

### `client.ts`
`oddsFetch<T>(path, params, revalidate)` — mirrors `mlb/client.ts`'s `mlbFetch`:
Next.js fetch caching with a TTL, `ODDS_API_KEY` injected as a query param,
throws a typed error on non-2xx (mirrors `MlbApiError`). New `TTL.odds` bucket
(lines move over hours, not seconds — a multi-hour TTL is appropriate; exact
value decided during planning based on API rate limits).

### `types.ts`
- `PropMarketKey` — union of the 7 market keys above.
- `PlayerProp` — `{ marketKey, playerName, line, overPrice, underPrice }`.
- `PropTier` — `"strong-over" | "lean-over" | "neutral" | "lean-under" | "strong-under"`.
- `ScoredProp` — a `PlayerProp` plus resolved `PlayerRef`, `tier`, and the
  stat value it was scored against (for display, e.g. "K/9: 9.8").

### `events.ts`
`findOddsEvent(awayTeamName, homeTeamName, commenceDateISO)` — lists the
sport's events for the date window and matches by team name pair. MLB team
`name` fields (e.g. "New York Yankees") match the Odds API's team-name
convention directly; no fuzzy matching needed here. Returns `null` if no event
matches (postponed/rescheduled games, or a game the odds API doesn't cover).

### `props.ts`
`getPlayerProps(eventId)` — fetches the 7 markets for one event in a single
request (Odds API supports comma-joined `markets` params), returns a flat
`PlayerProp[]`.

### `playerMatch.ts`
`matchPlayerName(oddsName, roster) => PlayerRef | null` — normalizes both sides
(strip accents, periods in initials, `Jr./Sr./II/III` suffixes, case-fold) and
matches on exact normalized full name. No fuzzy/Levenshtein matching — if a
name doesn't match after normalization, that prop is dropped rather than
risking a wrong player attribution.

### `highlight.ts`
`scoreProp(prop, statContext, weather) => ScoredProp`

- Pitcher strikeout props: derive K/9 from existing `SaberPitching` fields
  (`kPct` is rate-per-batter-faced, not per-inning — K/9 needs a small new calc
  using `ip` from `getSaberPitchingWithSeasonStats`: `k9 = (kPct-derived K count) * 9 / ip`).
  Compare against the line using bands similar in spirit to `statColor.ts`
  (e.g. K/9 comfortably above `line * 9/ip-implied-rate` → lean/strong over).
- Pitcher outs props: derived from IP directly (IP × 3 = outs); compare
  average outs/start against the line.
- Batter hits/total-bases/HR/RBI/walks props: use new `getSeasonHittingBasic()`
  (below) — AVG and H/PA for hits, SLG-derived extra-base rate for total
  bases, HR/PA for home runs, and season BB% (already available via
  `SaberHitting.bbPct`) for walks. RBI props use a simple RBI/game rate from
  the same season-stat fetch.
- Weather nudge: **only** applied to `batter_home_runs` and
  `batter_total_bases`. Pulls `windRelativeToPlate` category from the game's
  already-computed `GameWeather.gametime.wind` plus `tempRangeF`. Wind
  "out"-category or temp comfortably above a warm threshold nudges the tier one
  step toward "over"; wind "in" or cold nudges one step toward "under". This
  never flips a stat-driven "strong" tier to the opposite polarity — it only
  moves within the same direction or off a "neutral" baseline.
- Small-sample guard: reuse the spirit of `MIN_PA_FOR_COLOR` — pitchers with
  very low IP or batters with very low season PA get `tier: "neutral"`
  regardless of the raw numbers, since the underlying rate is noise.

## New player-stat fetch — `src/lib/mlb/players.ts`

`getSeasonHittingBasic(personId, season)` — `stats=season, group=hitting`,
same request pattern as `getSaberPitchingWithSeasonStats`. Returns AVG, OBP,
SLG, H, HR, RBI, BB, PA, games played. This is a plain season-stat fetch (no
sabermetrics group needed), kept separate from `getSaberHitting` since props
scoring needs raw counting/rate stats that function doesn't expose.

## Components

### `PropsSidebarSection.tsx`
Server component, data-fetching (parallels `WeatherSection`/`BullpenSection`
in `page.tsx`). Given `feed`, `season`, and the already-fetched `GameWeather`
(passed down rather than refetched):

1. `findOddsEvent(...)` — bail to empty state on `null`.
2. `getPlayerProps(eventId)` — bail to empty state on empty/error.
3. In parallel: `getRosterWithSeasonStats` for both teams (batters),
   `getSaberPitchingWithSeasonStats` for both probable starters,
   `getSeasonHittingBasic` for each matched batter.
4. Match, score, group by team, hand off to `PropsSidebar`.

Wrapped in the page's own `<Suspense>` boundary, matching existing sections.

### `PropsSidebar.tsx`
Presentational. Grouped by team → player, each prop row shows market label,
line, and a tier-colored badge/background using the existing red=good/
blue=bad convention (`GOOD_CLASS`/`BAD_CLASS` from `statColor.ts`, extended
with intermediate "lean" shades at lower opacity). Collapsed/empty state:
"No props available for this game."

## Layout change — `src/app/games/[gamePk]/page.tsx`

The page's root `<div className="space-y-5">` becomes a two-column grid on
large screens:

```
<div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
  <div className="space-y-5 lg:col-start-1">
    {/* all existing sections, unchanged */}
  </div>
  {!isDisrupted && isPreview && (
    <div className="lg:sticky lg:top-4">
      <Suspense fallback={<SectionSkeleton />}>
        <PropsSidebarSection feed={feed} season={season} weather={weatherResult} />
      </Suspense>
    </div>
  )}
</div>
```

Mobile: single column, sidebar stacks after the header (before or after the
existing sections — placed right after the header block so it's visible
without scrolling past the boxscore on game day). Exact stacking position
decided during implementation/visual review.

Note: `WeatherSection` currently fetches weather independently inside its own
async component. To avoid a duplicate weather fetch for the sidebar's wind
nudge, the page will lift the `getGameWeather` call up to the page body (it's
cheap and already TTL-cached) and pass the result into both `WeatherSection`
(or refactor it to accept the value) and `PropsSidebarSection`. This is a
small, targeted change to avoid a second fetch — not a broader refactor.

## Error handling

- Missing `ODDS_API_KEY` → sidebar renders nothing extra beyond the empty
  state (treated the same as "no props available"), logged once per request
  at most (no noisy repeated warnings).
- Any fetch failure (network, non-2xx, malformed response) → caught by
  `safe()`, falls back to empty state, never throws to the page.
- Odds API rate-limit (429) → treated as a fetch failure for this request;
  no retry logic (Next's fetch cache TTL naturally limits request frequency
  across users).

## Testing

- Unit tests for `playerMatch.ts` normalization (accents, suffixes, initials).
- Unit tests for `highlight.ts` tier scoring, including the weather-nudge
  boundary cases and the small-sample neutral guard.
- Manual verification in-browser: a Preview game with real props, a Preview
  game with no odds-API coverage (empty state), and a Live game (sidebar
  absent).
