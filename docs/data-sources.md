# Data sources and operating limits

The dashboard does not persist provider responses in an application database.
It does cache upstream responses, so operators remain responsible for each
provider's current terms, attribution, quotas, and acceptable use.

## MLB Stats API

- Base URL: `https://statsapi.mlb.com`
- Authentication: none.
- Used for schedules, live feeds, box scores, rosters, player statistics, and
  head-to-head history.
- Operational note: this is an undocumented public interface with no stability
  guarantee. Response fields can change without notice.

Cache requests and avoid aggressive polling. Team names, logos, player images,
statistics, and related trademarks remain the property of their respective
owners. This project is not affiliated with MLB or any club.

## Open-Meteo

- Base URL: `https://api.open-meteo.com/v1/forecast`
- Authentication: none for the free non-commercial API.
- Used for hourly temperature, humidity, precipitation, cloud cover, and wind.
- Cache TTL: 15 minutes.

Open-Meteo forecast data is CC BY 4.0 and requires visible attribution with a
link. The application provides this beside the weather report and in its footer.
The free endpoint is intended for non-commercial use and has published request
limits; use an appropriate commercial plan and endpoint before monetizing a
deployment.

## Odds API key rotation

Each odds provider reads its key(s) through a rotation pool (`src/lib/odds/keys.ts`).
A provider can hold several keys and rotates between them automatically so a
single rate-limited or invalid key cannot keep the slate empty. The pool is
re-read from env on every request, so adding or replacing a key via
`wrangler secret put` takes effect on the next request without a code deploy —
that is the hot-swap path.

Per-provider env vars (all optional; combine as needed):

- `SPORTSGAMEODDS_API_KEY` / `ODDS_API_KEY` — primary key (retained for backward
  compatibility, always used first).
- `SPORTSGAMEODDS_API_KEYS` / `ODDS_API_KEYS` — comma-separated list of all keys
  (primary first). Convenient for carrying several keys in one secret.
- `SPORTSGAMEODDS_API_KEY_2`, `_3`, `_4`, `_5` / `ODDS_API_KEY_2`, `_3`, `_4`,
  `_5` — individual secondary keys, each as its own secret. This is the usual
  rotation path: provision a fresh key, add it as `_2`, then optionally drop the
  old primary once confirmed healthy.

Rotation behaviour:

- A 200 response keeps the key usable.
- A 429 (rate limit) puts just that key into a short per-key backoff and rotates
  the request to the next key, instead of hammering the same rate-limited key.
- A 401 / invalid-key response cools off only that key and rotates to the next.
- A quota-exhaustion response (e.g. The Odds API `OUT_OF_USAGE_CREDITS`, or SGO
  "rate limit exceeded / quota" error strings) marks the whole pool exhausted for
  a lease window, because the researched providers share quota per subscription —
  rotating to another key would not buy quota.
- A transient failure (500, network, parse) rotates to the next key and, after
  repeated failures on one key, cools that key down so an unhealthy key is
  deprioritised.

Caveat: rotating keys buys resilience against a bad key and reduces repeated
rate-limit trips, but if all keys share one subscription it does **not** increase
the total monthly quota. Fully-exhausted quota still needs a renewed/upgraded
subscription.

## SportsGameOdds

- Base URL: `https://api.sportsgameodds.com/v2`
- Authentication: server-only `SPORTSGAMEODDS_API_KEY` sent as an `x-api-key`
  header, so the key never appears in cached or logged URLs.
- Used for the primary player-prop board: pre-game MLB props for strikeouts,
  outs recorded, hits, total bases, home runs, RBIs, and walks, priced at
  FanDuel first, then DraftKings, BetMGM, then any other available book.
- Cache TTL: 6 hours.

The free Amateur plan bills per event object (one game = one object regardless
of market count) with 2,500 objects/month, 10 requests/minute, 9 bookmakers,
and 10-minute upstream updates; the 6-hour cache keeps a full slate well inside
the monthly budget. When SportsGameOdds errors, has no key configured, or
returns no lines for a matchup, the app falls back to The Odds API below.

## The Odds API (fallback)

- Base URL: `https://api.the-odds-api.com`
- Authentication: server-only `ODDS_API_KEY` query parameter.
- Used only when the primary provider above is unavailable or empty.
- Cache TTL: 1 hour.

Requests are disabled when the key is absent. The client removes the key from
error URLs before errors are surfaced. Operators should monitor their own plan's
quota and terms because they can change independently of this repository; note
this provider bills per market × region × request, so it is the more expensive
path by design.

## Data quality

Weather, probable pitchers, lineups, market prices, and live feeds can be late,
revised, or unavailable. The dashboard is informational and should not be used
as the sole basis for wagering, safety, travel, or other consequential decisions.
