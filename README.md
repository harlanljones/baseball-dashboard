# Baseball Dashboard

[![CI](https://github.com/harlanljones/baseball-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/harlanljones/baseball-dashboard/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A live MLB scoreboard and game-day research dashboard built with Next.js. It
combines scores, box scores, matchup history, sabermetrics, bullpen workload,
ballpark weather, and optional player-prop context in one responsive interface.

This is an independent project. It is not affiliated with, endorsed by, or
sponsored by Major League Baseball or any MLB club.

## Features

- **Daily scoreboard** with Eastern-time date handling, previous/next-day
  navigation, and 30-second refreshes while a game is live.
- **Game detail pages** with linescores, box scores, season head-to-head results,
  probable starters, career batter-vs-pitcher splits, play-by-play, bullpen
  workload, and sortable roster tables.
- **Sabermetric context** including wOBA, wRC+, WAR, BABIP, ERA-, FIP, and xFIP.
- **Ballpark weather** from Open-Meteo, including wind direction relative to home
  plate and roof-aware presentation.
- **Optional player props** from The Odds API. The sidebar stays hidden and the
  rest of the game page remains available when no API key is configured.
- **Fail-soft sections** so a single unavailable upstream endpoint does not take
  down the entire game page.

## Technology

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Data | MLB Stats API, Open-Meteo, optional The Odds API |
| State | Stateless application; Next.js fetch caching backed by Cloudflare R2 in production |
| Tests | Vitest |
| Runtime | Cloudflare Workers through `@opennextjs/cloudflare` |
| Package manager | Bun 1.4.0 |

## Quick start

Prerequisites: [Bun](https://bun.sh/) 1.4.0 or newer and outbound access to the
upstream data services.

```bash
git clone https://github.com/harlanljones/baseball-dashboard.git
cd baseball-dashboard
bun install --frozen-lockfile
cp .env.example .env.local  # optional; enables player props when populated
bun run dev
```

Open <http://localhost:3000>. To inspect a specific date, use
`http://localhost:3000/?date=YYYY-MM-DD`.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `ODDS_API_KEY` | No | Server-only [The Odds API](https://the-odds-api.com/) key used by the player-props sidebar. |

Never commit `.env.local`, `.dev.vars`, or API credentials. The provided
[`.env.example`](.env.example) contains the complete variable inventory.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the Next.js development server. |
| `bun run lint` | Run ESLint. |
| `bun run typecheck` | Check TypeScript without emitting files. |
| `bun run test` | Run the unit test suite once. |
| `bun run build` | Create a production Next.js build. |
| `bun run check` | Run lint, type checking, tests, and the production build. |
| `bun run cf:build` | Produce the `.open-next` Worker bundle. |
| `bun run preview` | Build and serve the app in the local Workers runtime. |
| `bun run upload` | Build and upload an inactive Worker version. |
| `bun run deploy` | Build and deploy to Cloudflare Workers. |
| `bun run cf-typegen` | Regenerate Cloudflare binding types after config changes. |

## Project structure

```text
src/
├── app/          # App Router routes, loading states, and error boundaries
├── components/   # Server components and focused client-side islands
└── lib/
    ├── mlb/      # MLB client, response shaping, matchups, and player stats
    ├── odds/     # Optional prop lookup, matching, and scoring
    ├── weather/  # Ballpark metadata, forecasts, and wind calculations
    └── hooks/    # Shared client hooks
```

## Documentation

- [Documentation index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Deployment guide](docs/deployment.md)
- [Publishing checklist](docs/publishing.md)
- [Data sources and operational limits](docs/data-sources.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Changelog](CHANGELOG.md)

The dated files under `docs/superpowers/` and [PLAN.md](PLAN.md) are preserved
as historical design records. They are not the source of truth for the current
implementation.

## Data and trademarks

MLB statistics come from an undocumented public API and may change without
notice. Team names, logos, player images, statistics, and related trademarks
belong to their respective owners. Weather data is provided by
[Open-Meteo](https://open-meteo.com/) under CC BY 4.0. Review
[the data-source notes](docs/data-sources.md) before operating a public or
commercial deployment.

## Contributing and security

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
opening a pull request. Please report security issues privately according to
[SECURITY.md](SECURITY.md), not in a public issue.

## License

The source code is available under the [MIT License](LICENSE).
