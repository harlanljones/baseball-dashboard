# Changelog

All notable changes to this project will be documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases will use
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Offseason home page: between the end of the World Series and spring
  training, an empty date shows a countdown to next Opening Day, the
  postseason recap (champion, series results, final game), and final
  regular-season standings instead of "No games scheduled".
- SportsGameOdds as the primary player-prop odds provider: one cached
  league-wide request per 6-hour window prices the whole slate's tracked prop
  markets (per-event billing keeps the free tier inside its monthly budget),
  with FanDuel → DraftKings → BetMGM bookmaker preference and matched-line
  pairing per book.
- Automatic fallback to The Odds API whenever the primary provider is unset,
  errors, resolves no event, or posts zero props for a matchup.
- `SPORTSGAMEODDS_API_KEY` environment variable (`.env.example`, deployment,
  and security docs updated alongside the existing `ODDS_API_KEY`).
- Odds provider failures that fall back to an empty board are now logged as
  `[odds] ...` warnings in Workers Logs, with the provider's own message (for
  example a rate limit or spent quota), so a thin or empty props board can be
  traced to its cause.
- Postseason game pages show the current round's games (for example the
  Division Series so far) ahead of the regular-season series, and bullpen
  pitch counts include each team's recent playoff outings.

### Changed

- Player-prop loading is now provider-agnostic (`loadGamePlayerProps`), so the
  game-page sidebar, props page, and best-leans board require no per-provider
  logic and keep failing soft to an empty board.

- Public contribution, conduct, security, deployment, publishing, and data-source guidance.
- GitHub Actions validation for linting, type checking, tests, and production builds.
- Reproducible Bun toolchain and repository metadata.

### Changed

- Refreshed the README and architecture documentation to match the current app.
- Documented the required Cloudflare R2 and Durable Object cache resources.
- Added required Open-Meteo attribution beside weather reports and in the application footer.

### Fixed

- Odds key rotation: `*_API_KEY_5` is now read, a provider configured only
  through `*_API_KEYS` or numbered keys is no longer treated as unset, and a
  key rejected (401) or rate-limited (429) retries the same request on the next
  key instead of returning an empty board.
- The props page no longer claims rows reorder only when a weight adjustment
  commits; they re-sort as the sliders move.
- Batter-vs-pitcher pages are now ISR-cached (6-hour revalidation) instead of
  re-rendered per request, which exceeded the Workers free-plan CPU limit when
  crawlers requested many matchup URLs at once (`exceededCpu` / 503s).
- Unknown player ids on the vs-pitcher page render the not-found page instead
  of erroring with an unhandled upstream 404.
