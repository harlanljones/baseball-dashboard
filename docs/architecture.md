# Architecture

Current state of the source tree as of 2026-08-21. `PLAN.md` and
`docs/superpowers/{plans,specs}` are the historical design record; this file
describes what actually shipped.

## Routes (`src/app`)

| Route                              | Rendering            | Contents |
| ---------------------------------- | -------------------- | -------- |
| `/`                                | Dynamic per request (`?date=`) | Today's scoreboard: `GameCard` grid, off-day empty state with prev/next-day links, date override via query param. |
| `/games/[gamePk]`                  | Dynamic              | One live-feed await, then independent `<Suspense>` sections (see below). |
| `/players/[batterId]/vs/[pitcherId]` | Dynamic            | Career batter-vs-pitcher history. |
| `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx` | — | Shell, skeletons, retry UI at both root and game level. |

### Game page sections

Header + status badge + local time, then each of these fails independently to
an inline notice:

- **Linescore / BoxscoreTables** — inning-by-inning and per-team batting/pitching tables.
- **HeadToHead** — season series record plus completed meetings.
- **ProbableStartersSection** — probables/starters with sabermetric cards.
- **MatchupTable** (per pitching side) — career batter-vs-pitcher splits for the
  lineup; pre-game it proxies with the active roster hydrated with season stats,
  top 9 by PA.
- **GameLogSection** — play-by-play / scoring log for live and final games.
- **Bullpen** — reliever usage from the boxscore.
- **BallparkWeather** — hourly Open-Meteo forecast at the venue, wind relative
  to the plate; skips domed parks' weather nudge appropriately.
- **RosterStatsSection** — sortable full-roster sabermetric tables
  (`RosterStatsTable`, `RosterStatsRow`, `SortableHeaderCell`,
  `useSortableTable`).
- **PropsSidebarSection → PropsSidebar** — scored player props in a resizable
  split pane (`GameSplitPane`, persisted width via `lib/paneWidth.ts`). Only
  renders when `ODDS_API_KEY` is set; every data fetch inside is fail-soft.

## Components (`src/components`)

Mostly server components. Client islands: `AutoRefresh` (30s
`router.refresh()` only while a game is Live), sortable table machinery
(`RosterStatsTable`, `MatchupTable`, `BoxscoreTables` use
`useSortableTable`/`SortableHeaderCell`), `GameSplitPane` (drag-resizable),
and image helpers (`TeamLogo`, `PlayerHeadshot`) that consume the
`mlbstatic.com` remote patterns configured in `next.config.ts`.

## Data layer

### `src/lib/mlb`

- `client.ts` — `mlbFetch<T>(path, params, revalidate, tags)` wrapping Next.js
  fetch caching; `TTL` map (live 30s, head-to-head 1h, player stats 6h,
  rosters 24h, pitcher logs 3h, weather 15m); `MlbApiError`;
  `easternToday`/`easternDateOf` (all "today" logic is `America/New_York`).
- `schedule.ts` — day schedule + head-to-head season series.
- `game.ts` — live feed (`/api/v1.1/game/{gamePk}/feed/live`) shaping.
- `players.ts` — sabermetrics, vsPlayer stats, roster-with-season-stats,
  pitcher prop stats / recent form / home-away splits.
- `matchup.ts` — builds matchup rows; fans out ≤18 parallel calls with
  `Promise.allSettled`.
- `types.ts` — domain types shared by components.

### `src/lib/odds`

Mirrors the MLB client pattern against The Odds API (1h TTL):

- `client.ts` — key lookup (`ODDS_API_KEY`, fail-closed when unset), `OddsApiError`.
- `events.ts` — find the odds event matching an MLB game.
- `props.ts` / `types.ts` — available player props and parsing.
- `playerMatch.ts` — fuzzy name matching between odds and MLB rosters.
- `highlight.ts` — scores props against matchup/stat context to rank them.

### `src/lib/weather`

- `ballparks.ts` — venue id → coordinates/name/roof info.
- `openMeteo.ts` — hourly forecast fetch.
- `wind.ts` — wind-relative-to-plate math, WMO code → sky label, compass text.
- `report.ts` — composes a `GameWeather` for a game.

### Misc

- `src/lib/format.ts` — display formatting helpers.
- `src/lib/statColor.ts` — stat-value → Tailwind class buckets used by tables.
- `src/lib/paneWidth.ts` — split-pane width persistence (+ tests).

## Tests

Vitest (`bun run test`): `src/lib/__tests__`,
`src/lib/mlb/__tests__`, `src/lib/odds/__tests__`. Pure-function coverage for
prop scoring/matching, prop stats math, and pane width. No component tests.

## Deployment

Runs on Cloudflare Workers via `@opennextjs/cloudflare`
(`wrangler.jsonc`, `open-next.config.ts`). `next dev` stays the daily driver;
`initOpenNextCloudflareForDev()` in `next.config.ts` wires bindings for local
dev. See README "Deploying" for commands and caveats (Images binding, R2 cache).
