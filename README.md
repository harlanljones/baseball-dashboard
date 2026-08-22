# baseball-dashboard

A live MLB web dashboard built with Next.js. The home page shows today's
scoreboard (with date navigation via `?date=YYYY-MM-DD`), and each game page
drills into the linescore, boxscore, head-to-head season series, batter-vs-pitcher
matchup tables, sabermetric starter cards, bullpen status, ballpark weather,
and an optional player-props sidebar.

## Features

- **Today's scoreboard** — schedule for the current Eastern-time date, with
  prev/next-day links, auto-refresh (30s) while any game is live.
- **Game pages** (`/games/[gamePk]`) — independent sections that each degrade
  gracefully: linescore + boxscore, season head-to-head, per-pitcher matchup
  tables (career batter-vs-pitcher splits; active-roster proxy pre-game),
  sabermetric cards for probables/starters and top hitters, bullpen usage,
  and hourly ballpark weather from Open-Meteo.
- **Matchup page** (`/players/[batterId]/vs/[pitcherId]`) — career history
  between any two players.
- **Player props sidebar** (optional) — scored prop suggestions from
  [The Odds API](https://the-odds-api.com), matched against MLB stats. Fails
  closed when no API key is configured.
- **Sabermetrics** — wOBA, wRC+, WAR, BABIP, ERA-, FIP, xFIP from the MLB
  Stats API's `sabermetrics` stat group.

## Stack

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router, Turbopack), React 19, TypeScript          |
| Styling    | Tailwind CSS v4                                                   |
| Data       | Public MLB Stats API (no key) + Open-Meteo (no key); no database  |
| Caching    | Next.js fetch cache with per-endpoint `revalidate` TTLs           |
| Testing    | Vitest                                                            |
| Deployment | Cloudflare Workers via [@opennextjs/cloudflare][opennext]         |

[opennext]: https://opennext.js.org/cloudflare

All upstream calls are throttled through `mlbFetch` / `oddsFetch` with TTLs
tuned per data volatility (live feed 30s → rosters 24h). "Today" is always
computed in `America/New_York`.

## Getting started

Requires [bun](https://bun.sh).

```bash
bun install
cp .env.example .env.local   # optional — only needed for the props sidebar
bun dev
```

Open <http://localhost:3000>. On off-days the home page shows an empty state;
use `/?date=2026-07-11` to browse a played date.

### Environment variables

| Variable       | Required | Purpose                                                        |
| -------------- | -------- | -------------------------------------------------------------- |
| `ODDS_API_KEY` | No       | [The Odds API](https://the-odds-api.com) key. Hides the player-props sidebar when unset; never blocks the rest of the page. |

## Scripts

```bash
bun dev        # Next.js dev server (Turbopack)
bun run build  # production build
bun run lint   # eslint
bun run test   # vitest (unit tests in src/lib/**/__tests__)

# Cloudflare Workers (via OpenNext)
bun run preview      # build + serve locally in workerd
bun run deploy       # build + deploy to your Cloudflare account
bun run cf-typegen   # regenerate cloudflare-env.d.ts after wrangler.jsonc changes
```

## Deploying to Cloudflare Workers

The app runs on Workers using the OpenNext adapter — see
[`wrangler.jsonc`](wrangler.jsonc) and [`open-next.config.ts`](open-next.config.ts).

1. Log in: `bunx wrangler login`
2. Preview locally in the Workers runtime: `bun run preview`
3. Deploy: `bun run deploy`
4. If you use the props sidebar, set the secret:
   `bunx wrangler secret put ODDS_API_KEY`

Notes:

- `next/image` optimization uses the Cloudflare Images `IMAGES` binding
  (see [pricing](https://developers.cloudflare.com/images/pricing/)). To skip
  it, remove the `images` block from `wrangler.jsonc` and set
  `images: { unoptimized: true }` in `next.config.ts`.
- Next's data cache is in-memory per isolate by default. To persist ISR/fetch
  cache across isolates, add an R2 bucket named in a
  `NEXT_INC_CACHE_R2_BUCKET` binding — see the
  [OpenNext caching docs](https://opennext.js.org/cloudflare/caching).
- Alternatively, connect the GitHub repo to Workers Builds for automatic
  deploys on push.

## Project layout

```
src/
├── app/                    # App Router routes (home, /games/[gamePk], /players/x/vs/y)
├── components/             # Server components + small client islands (AutoRefresh, sortable tables)
└── lib/
    ├── mlb/                # MLB Stats API client, endpoints, domain types
    ├── odds/               # The Odds API client, prop scoring/matching
    ├── weather/            # Ballpark coordinates, Open-Meteo forecast, wind helpers
    └── hooks/              # Shared client hooks (sortable tables)
```

See [`docs/architecture.md`](docs/architecture.md) for a deeper tour of the
current implementation, and [`PLAN.md`](PLAN.md) for the original design plan.

## License

[MIT](LICENSE)
