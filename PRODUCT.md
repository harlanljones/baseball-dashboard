# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Baseball Dashboard serves a broad range of MLB bettors, from casual users looking for a quick read to experienced users comparing several signals before deciding whether a player prop is worth further consideration.

## Product Purpose

The product is a game-day MLB research dashboard. It brings scores, matchup history, sabermetrics, bullpen workload, weather, and player-prop context into one place so users can understand a game and identify promising props without assembling the context across several tools.

Success means a user can move from the daily slate into one game, understand why a prop leans over or under, compare the strength of that lean with alternatives, and inspect the evidence behind it.

## Positioning

Player-prop recommendations are research signals rather than opaque picks. Each lean should expose model confidence, statistical edge versus the posted line, and market value from the available odds. Users can change the relative weight of those three inputs and see a transparent cumulative score respond.

## Operating Context

Users begin with the daily MLB slate, may scan a cross-game summary of the day's strongest leans, and then open a dedicated player-props page for one game. The one-game surface supports focused comparison across players, teams, prop markets, and over/under directions. The broader slate component is a separate summary surface for discovery, not a substitute for the game-level analysis.

## Capabilities and Constraints

- The application uses MLB game and player data, ballpark weather, and optional player-prop odds from SportsGameOdds with The Odds API as a fallback provider.
- Player-prop features must remain optional and fail softly when odds, statistics, weather, or an API credential are unavailable.
- The dedicated prop-analysis page covers one game. A separate component covers the best leans across all games on the selected slate.
- Every scored prop exposes model confidence, statistical edge, market value, and a cumulative score.
- Users can control the relative weight of the three score inputs with sliders. The normalization and default weights remain implementation decisions that must be made explicitly rather than inferred by a builder.
- The product presents research context and leans; it must not imply guaranteed outcomes.

## Brand Commitments

Preserve the Baseball Dashboard name and its concise, evidence-first voice. The incumbent ballpark-inspired identity and baseball-specific terminology are established product assets; this product record does not redefine their visual expression.

## Evidence on Hand

- MLB scores, schedules, rosters, player statistics, probable starters, matchup history, and play-by-play data.
- Sabermetric context including wOBA, wRC+, WAR, BABIP, ERA-, FIP, and xFIP.
- Ballpark weather and wind context from Open-Meteo.
- Player-prop lines and prices from SportsGameOdds when configured, with The Odds API as a fallback when the primary is unavailable or has no lines.
- Existing prop evidence includes season average relative to the line, weather-sensitive adjustments, recent form, home/away context, platoon context, and batter-versus-pitcher history where available.
- No outcome guarantees, user testimonials, or independently validated prediction-performance claims are on hand and none should be fabricated.

## Product Principles

- Show the evidence behind every lean.
- Make comparison fast without hiding uncertainty or missing data.
- Keep expert controls available while preserving a useful default for casual users.
- Separate slate-wide discovery from game-level analysis.
- Degrade gracefully when an upstream data source is unavailable.

## Accessibility & Inclusion

The interface serves users with varied betting and statistical fluency. Direction, score, and state must never rely on color alone, and the meaning of specialized metrics and user-controlled weights must be available in plain language.
