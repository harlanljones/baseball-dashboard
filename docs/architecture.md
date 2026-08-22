# Architecture

This document describes the implementation as of 2026-08-22. The source tree
and tests remain authoritative when this overview falls behind.

## System overview

The application is a stateless Next.js App Router project. Server Components
fetch and shape upstream data; a small set of Client Components handles polling,
sorting, image fallbacks, and the resizable props pane. There is no application
database, authentication layer, or custom JSON API.

```text
Browser
  └─ Next.js routes and Server Components
       ├─ MLB Stats API        scores, feeds, rosters, and player stats
       ├─ Open-Meteo           venue forecasts
       └─ The Odds API         optional player props
            └─ Next fetch cache → OpenNext incremental cache → Cloudflare R2
```

## Routes

| Route | Rendering | Responsibility |
| --- | --- | --- |
| `/` | Dynamic | Daily schedule selected by `?date=YYYY-MM-DD`; defaults to the current Eastern-time date. |
| `/games/[gamePk]` | Dynamic and streamed | Game header plus independent suspense sections for scores, matchups, players, weather, and props. |
| `/players/[batterId]/vs/[pitcherId]` | ISR (6h) | Career batter-vs-pitcher history; empty `generateStaticParams` so pairings render on first visit and cache afterward. |
| `loading.tsx`, `error.tsx`, `not-found.tsx` | Framework boundaries | Accessible loading, retry, and missing-resource states. |

The home route uses the request-time `searchParams` API. It intentionally does
not export `dynamic = "force-dynamic"`; in this Next.js version that setting
would force upstream fetches to `no-store` and defeat their revalidation TTLs.

### Game-page composition

The game page reads the live feed once, then isolates downstream work so one
provider or statistic can fail without suppressing the rest of the page:

- `Linescore` and `BoxscoreTables` render inning and team totals.
- `HeadToHead` summarizes the current season series.
- `ProbableStartersSection` renders starter form, splits, and sabermetrics.
- `MatchupTable` renders career and contextual batter-vs-pitcher splits.
- `GameLogSection` renders significant plays grouped by inning.
- `Bullpen` combines box-score usage with recent workload.
- `BallparkWeather` aligns an hourly venue forecast with game time and home plate.
- `RosterStatsSection` renders sortable team-wide hitting and pitching tables.
- `PropsSidebarSection` matches optional market data to MLB players and context.

## Component boundaries

Most components render on the server. Client Components are limited to
interaction that requires browser state:

- `AutoRefresh` calls `router.refresh()` every 30 seconds only while a game is live.
- `GameSplitPane` persists the props-pane width in local storage.
- `RosterStatsTable`, `MatchupTable`, and `BoxscoreTables` share sortable-table logic.
- `TeamLogo` and `PlayerHeadshot` handle remote images and fallbacks.

## Data layer

### MLB (`src/lib/mlb`)

- `client.ts` owns the base URL, typed errors, cache TTLs, and Eastern-time helpers.
- `schedule.ts` shapes daily schedules and season head-to-head records.
- `game.ts` shapes live feeds and significant plays.
- `players.ts` fetches player, roster, split, recent-form, and bullpen statistics.
  Multi-player statistics use hydrated batch requests where the upstream API
  supports them to avoid per-player request fan-out.
- `matchup.ts` assembles both matchup sides from pre-fetched batch maps.
- `types.ts` contains the domain model consumed by routes and components.

### Odds (`src/lib/odds`)

The Odds API path is optional and fail-closed. `client.ts` reads the server-only
`ODDS_API_KEY` and strips it from error URLs. The remaining modules find the MLB
event, parse player props, match player names, and rank contextually interesting
lines. No key means no sidebar; it never blocks core game data.

### Weather (`src/lib/weather`)

`ballparks.ts` maps venues to coordinates and roof metadata. `openMeteo.ts`
fetches UTC hourly forecasts. `wind.ts` converts compass wind into plate-relative
direction, and `report.ts` selects the forecast nearest game time.

## Caching and resilience

All upstream requests use Next.js fetch revalidation. Current TTLs are:

| Data | TTL |
| --- | ---: |
| Live schedule and game feed | 30 seconds |
| Weather | 15 minutes |
| Head-to-head schedule | 1 hour |
| Odds | 1 hour |
| Pitcher game logs | 3 hours |
| Player stats | 6 hours |
| Rosters and past schedules | 24 hours |

In production, OpenNext stores the incremental cache in the
`NEXT_INC_CACHE_R2_BUCKET` R2 binding and uses the `NEXT_CACHE_DO_QUEUE` Durable
Object to deduplicate time-based revalidation. A regional cache fronts R2.
Independent suspense/error boundaries and `Promise.allSettled` preserve partial
results when an upstream request fails.

The batter-vs-pitcher route also uses page-level ISR (`revalidate = 21600`) so
matchup pages are not fully re-rendered on every crawler hit. That keeps Workers
CPU usage within free-plan limits when many unknown pairings are requested.

## Testing

Vitest covers pure data shaping, name matching, prop scoring, batched player
statistics, and pane-width persistence. ESLint, TypeScript, Vitest, and the
production build run in CI. Async Server Components currently rely on build
coverage and manual route verification rather than component-unit tests.

## Deployment

OpenNext transforms the Next.js build into `.open-next/worker.js`. Wrangler
binds static assets, the self-reference service, R2 cache, and Durable Object
queue. See [deployment.md](deployment.md) for the required Cloudflare resources,
first deploy, Workers Builds settings, and release checks.
