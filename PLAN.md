# Scaffold `baseball-dashboard` — Next.js MLB Web Dashboard

> **Status: historical.** This is the original build plan (2026-07-13), kept
> for context. The app has since grown well beyond it — live game logs,
> bullpen tracking, ballpark weather, sortable roster tables, a player-props
> sidebar, a head-to-head matchup route, and Cloudflare Workers deployment.
> See [`docs/architecture.md`](docs/architecture.md) for the current state of
> `src/` and the README for usage/deployment.

## Context


Brand-new project in the empty directory `/mnt/c/Users/harlan/GitHub/baseball-dashboard` (only `.claude/settings.json` exists). Goal: a web dashboard where the home page shows today's MLB scores and each game page shows historical matchup stats and sabermetric player evaluations.

User-confirmed decisions:
- **Stack**: Next.js full-stack (TypeScript, App Router) — no Python backend.
- **Persistence**: none — stateless, using Next.js fetch caching with per-endpoint TTLs.
- **Sabermetrics**: pull published stats from the MLB Stats API (`statsapi.mlb.com`, free, no key). Its `sabermetrics` stat group provides wOBA, wRC+, WAR, FIP, etc. (verified live).

The sibling `mlb-dashboard` repo was explored: it's a mostly-stub ML scaffold with **no** scores/schedule/game functionality to reuse. This is a fresh build; we mirror only conventions (bun, TypeScript, React).

Environment facts (verified): bun is **not** installed in WSL (install it first; npm via Windows Node is the fallback); WSL git can't lock files on `/mnt/c`, so all git ops use `git.exe`; today (2026-07-13) is an All-Star-break off-day — the schedule API returns `dates: []`, so a `?date=` override is needed to develop against real games (e.g. 2026-07-11 had 16 games, sample gamePk `823357`).

## Scaffold

```bash
curl -fsSL https://bun.sh/install | bash    # pre-flight: install bun in WSL
cd /mnt/c/Users/harlan/GitHub/baseball-dashboard
mv .claude /tmp/claude-stash-baseball        # create-next-app rejects unknown files in target
bunx create-next-app@latest . --typescript --eslint --app --tailwind \
  --src-dir --import-alias "@/*" --turbopack --disable-git --use-bun
mv /tmp/claude-stash-baseball .claude
git.exe init && git.exe add -A && git.exe commit -m "Scaffold Next.js app"
```

Config choices: Tailwind **yes** (many small cards/tables/badges, no design system); react-query **no** (all fetching is server-side; live refresh is a tiny client component); recharts/d3/axios **no** (no charts in scope; native `fetch` required for Next's data cache); no extra deps.

## File tree (~20 source files)

```
src/
├── app/
│   ├── layout.tsx                 # header + container
│   ├── globals.css                # Tailwind + status-color tokens
│   ├── page.tsx                   # HOME: today's scoreboard (server component, reads ?date=)
│   ├── loading.tsx / error.tsx    # skeleton grid / "MLB API unreachable" + retry
│   └── games/[gamePk]/
│       ├── page.tsx               # GAME PAGE: 4 sections, each in <Suspense>
│       └── loading.tsx / error.tsx
├── components/
│   ├── AutoRefresh.tsx            # "use client": setInterval → router.refresh()
│   ├── GameCard.tsx               # teams+records, score, status badge, probables, link
│   ├── GameStatusBadge.tsx        # Live/Final/Postponed/Preview pill
│   ├── Linescore.tsx              # inning-by-inning + R/H/E
│   ├── BoxscoreTables.tsx         # batting/pitching tables per team
│   ├── HeadToHead.tsx             # season series record + completed meetings
│   ├── MatchupTable.tsx           # batter-vs-pitcher: PA/H/HR/BB/K, AVG/OBP/SLG
│   └── SaberCard.tsx              # hitter: wOBA/wRC+/WAR/BABIP; pitcher: WAR/FIP
└── lib/mlb/
    ├── client.ts                  # mlbFetch<T> with TTL constants + MlbApiError
    ├── types.ts                   # domain types (ScheduleGame, Linescore, SaberHitting, …)
    ├── schedule.ts                # getSchedule(date), getHeadToHead(teamA, teamB, season)
    ├── game.ts                    # getLiveFeed(gamePk) → status/linescore/boxscore/probables
    ├── players.ts                 # getSaberStats, getVsPlayer, getRosterWithSeasonStats
    └── matchup.ts                 # buildMatchups: pick hitters, fan out via Promise.allSettled
```

No `app/api/` route handlers — nothing consumes JSON client-side; `router.refresh()` re-runs server components.

## Data layer

- `mlbFetch<T>(path, params, revalidate, tags)` → `fetch(..., { next: { revalidate, tags } })`. TTLs: live schedule/feed **30s**; head-to-head **1h**; player stats (saber, vsPlayer) **6h**; rosters **24h**. Past-date schedules get the long TTL.
- Key endpoints: schedule `GET /api/v1/schedule?sportId=1&date=…&hydrate=team,linescore,probablePitcher(note),decisions`; live feed `GET /api/v1.1/game/{gamePk}/feed/live`; batter-vs-pitcher `GET /api/v1/people/{batterId}/stats?stats=vsPlayer&group=hitting&opposingPlayerId={pitcherId}`; sabermetrics `GET /api/v1/people/{id}/stats?stats=sabermetrics&group=hitting|pitching`; head-to-head `GET /api/v1/schedule?sportId=1&teamId=A&opponentId=B&startDate=…&endDate=…`.
- **"Today" is Eastern time** — compute via `Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' })`, never `toISOString()`. Home page is `dynamic = "force-dynamic"` (date computed per request; upstream still throttled by fetch cache).
- **Live refresh**: `AutoRefresh` polls `router.refresh()` every 30s, `enabled` only when the server saw a live game (`abstractGameState === "Live"`), so off-days don't poll. Worst-case staleness ≈ 60s.

## Game page composition

One `getLiveFeed(gamePk)` await, then four independent async sections in `<Suspense>`, each with internal try/catch so one failure degrades to an inline notice:

1. **Header + Linescore + Boxscore** — from the feed; Preview games show start time + probables instead.
2. **Head-to-head** — one schedule call for the season series; derive W-L by counting winners; list meetings with scores/links.
3. **Matchup tables** (one per pitching side) — pitcher: boxscore starter (Live/Final) or `gameData.probablePitchers` (Preview; if absent → "Probable pitcher TBD", skip table). Hitters: boxscore `battingOrder` 100–900 when Live/Final; for Preview, proxy with active roster hydrated with season hitting stats, top 9 by PA (documented as a proxy). ≤18 parallel `getVsPlayer` calls via `Promise.allSettled`.
4. **Saber cards** — both starting/probable pitchers (WAR, FIP) + top 3–5 hitters per team (wOBA, wRC+, WAR, BABIP), current season.

## Edge cases

- Off-day (`dates: []` — true today): empty state + prev/next-day `?date=` links.
- Postponed/suspended: badge; game page hides linescore/boxscore, keeps H2H + saber.
- No probable pitcher → "TBD"; no vsPlayer history → em-dash row "no career history" (common, not an error); rookie with no saber split → skip/em-dash.
- Bad gamePk → 404 from feed → `notFound()`. MLB API 5xx → `error.tsx` on home; per-section notices on game page.

## Implementation order (verify at each step)

1. Install bun; confirm `git.exe --version`.
2. Scaffold + first `git.exe` commit. Verify: `bun dev`, curl localhost:3000.
3. `client.ts` + `types.ts` + `schedule.ts`. Verify: curl the raw schedule endpoint for 2026-07-11, confirm mapped fields.
4. Home page (`page.tsx`, `GameCard`, `GameStatusBadge`, loading/error). Verify: `curl "localhost:3000/?date=2026-07-11"` shows team names + "Final"; bare `/` shows the off-day empty state.
5. `AutoRefresh`. Verify: no polling on off-day (enabled=false).
6. Game page core (`game.ts`, header, `Linescore`, `BoxscoreTables`). Verify: `curl localhost:3000/games/823357`; bogus gamePk → 404.
7. Head-to-head. Verify: series W-L matches manual count from raw JSON.
8. Matchups (`players.ts`, `matchup.ts`, `MatchupTable`). Verify: 9-row tables on a Final game; Preview game exercises roster-proxy path.
9. Saber cards. Verify: spot-check wRC+/WAR against raw endpoint (Judge 592450: wRC+≈204.5, WAR≈10.1 for 2025).
10. Polish: skeletons, postponed styling, `bun run build` (type-safety smoke test), `bun run lint`, `bun start` + curl `/`, `/?date=2026-07-11`, `/games/823357`.
11. `git.exe` commits at milestones (steps 2, 4, 6, 8, 10).

## Deferred

Standings, team/player pages, charts, date-picker UI, play-by-play/win probability, tests beyond build/lint/curl, on-demand revalidation, auth/persistence.
