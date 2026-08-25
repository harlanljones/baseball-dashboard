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
