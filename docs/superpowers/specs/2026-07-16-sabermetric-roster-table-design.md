# Sabermetric Evaluations: Roster Table Design

**Date:** 2026-07-16  
**Status:** Approved

## Overview

Replace the current "Sabermetric evaluations" section on the game page (which displays starting pitcher + top 4 hitters as individual SaberCards) with a comprehensive roster table showing all active roster players for both teams, sorted by position and enriched with sabermetric stats.

## Goals

- **Complete roster visibility:** Show all active players, not just game participants
- **Position-organized view:** Group players by MLB position (SP, RP, C, 1B, 2B, 3B, SS, LF, CF, RF)
- **Evaluation metrics:** Display sabermetric and seasonal stats optimized per position type
- **Clean data:** Only show players with available stats (no empty rows)

## Data Architecture

### Roster Fetching

1. Call `/api/v1/teams/{teamId}/roster?rosterType=active` for both away and home teams
2. Extract player IDs and basic info (name, position)
3. Partition players into hitters (non-Pitcher) and pitchers

### Stats Fetching

For each player, fetch stats in parallel:

- **Hitters:** `getSaberHitting(personId, season)` + season hitting stats (PA, BB%, K%)
  - Note: BB% and K% come from `statSplits` group with `sitCodes` (all PA)
- **Pitchers:** `getSaberPitching(personId, season)` + season pitching stats (IP, ERA, BB%, K%)
  - Note: BB% and K% come from raw season pitching (calculated as `BB/BF` and `K/BF`)

### Data Filtering

- Include only players with non-null sabermetric or season stats
- Skip players with no stats available (recent call-ups, unsigned roster slots)
- No placeholder rows or "no data" stubs

### Sorting

Group by position in this order: **SP, RP, C, 1B, 2B, 3B, SS, LF, CF, RF**  
Within each position, sort alphabetically by name (or by a primary stat like WAR descending — user choice at render time via sortable headers).

## Column Specifications

### Hitters (C, 1B, 2B, 3B, SS, LF, CF, RF)

| Column | Type | Source | Format | Notes |
|--------|------|--------|--------|-------|
| Position | string | Roster | "C", "1B", etc. | MLB position abbreviation |
| Name | string | Roster | Full name | Clickable to player page (if available) |
| WAR | number | Sabermetrics | `dec1()` | Wins above replacement; statClass graded |
| wRC+ | number | Sabermetrics | `int()` | Weighted runs created, park-adjusted |
| PA | number | Season | `int()` | Plate appearances |
| wOBA | number | Sabermetrics | `rate3()` | Weighted on-base average; statClass graded |
| xwOBA | number | Sabermetrics | `rate3()` (fallback to wOBA) | Expected wOBA; if unavailable in API, show wOBA with a comment in code |
| BB% | number | Season splits | `pct()` formatted | Walk rate |
| K% | number | Season splits | `pct()` formatted | Strikeout rate |

### Pitchers (SP, RP)

| Column | Type | Source | Format | Notes |
|--------|------|--------|--------|-------|
| Position | string | Roster | "SP" or "RP" | Derived from role or roster position |
| Name | string | Roster | Full name | |
| WAR | number | Sabermetrics | `dec1()` | Wins above replacement; statClass graded |
| ERA- | number | Sabermetrics | `int()` | ERA adjusted to league average; statClass graded |
| IP | number | Season | String with decimals | Innings pitched (e.g. "123.1") |
| ERA | number | Season | `dec2()` | Earned run average |
| FIP | number | Sabermetrics | `dec2()` | Fielding-independent pitching; statClass graded |
| xFIP | number | Sabermetrics | `dec2()` | Expected FIP; statClass graded |
| K% − BB% | number | Season stats | `pct()` | Strikeout rate minus walk rate; single composite column |

**Note on K% − BB%:** Calculated as `(K / BF) − (BB / BF)` where BF = batters faced. Represents net discipline (higher = better).

## Component Structure

### New/Modified Components

- **RosterStatsTable** (new)
  - Props: `away: TeamRosterStats`, `home: TeamRosterStats`, `season: number`
  - Children: team name/logo header, hitter table, pitcher table
  - Uses existing `SortableHeaderCell` and `statClass()` for styling

- **RosterDataRow** (new, or reuse a generic table row component)
  - Props: Player data + stats, position, columns to display
  - Renders cells with proper formatting (decimals, colors, dashes for missing)

### Modified Files

- `src/app/games/[gamePk]/page.tsx`
  - Replace `SaberSection()` component with `RosterStatsSection()`
  - Keep `TeamSaber` for reuse or delete if only used in SaberSection

## Error Handling

- **Roster fetch fails:** Show `SectionError` (existing pattern)
- **Individual player stats fail:** Skip that player (no empty rows)
- **Partial data:** If a player has some stats but not others, render available columns with dashes (using `rate3()`, `int()`, `dec2()` helpers)

## Styling & Theming

- Use existing Tailwind classes from `src/styles/globals.css` (theme tokens, card, eyebrow, etc.)
- Table structure: `<table>` with `<thead>`, `<tbody>` (or semantic div-based if matching MatchupTable pattern)
- Row striping (optional): alternating row backgrounds for readability
- Column width: balance (prioritize position, name; compress stats)
- Responsive: stack vertically on mobile, two-column grid on lg breakpoint

## API Constraints & Unknowns

1. **xwOBA availability:** Currently not explicitly fetched in `getSaberHitting()`. If present in sabermetrics group, include; otherwise, fallback to wOBA and add a code comment explaining.
2. **BB% and K% for pitchers:** These are not in the current `SaberPitching` interface. Will need to:
   - Fetch full season pitching stats (walks, strikeouts, batters faced)
   - Calculate rates in the component or a helper function
3. **Roster position field:** Confirm MLB's `/roster` endpoint provides a reliable `position.type` field (e.g., "Pitcher", "Catcher", "Outfielder"). If position is "Pitcher", split into SP vs RP based on role or depth chart; if unavailable, default to RP.

## Testing Checklist

- [ ] Roster fetch succeeds for both teams
- [ ] Only players with stats appear (no empty rows)
- [ ] Positions are correctly labeled and grouped (SP, RP, C, 1B, etc.)
- [ ] Stats display with correct formatting (decimals, percentages, dashes)
- [ ] StatClass coloring works for sabermetric columns (WAR, wRC+, wOBA, ERA-, FIP, xFIP)
- [ ] Table is responsive (mobile: stacked; lg: side-by-side)
- [ ] Sortable headers work (if implemented)
- [ ] Fallback to existing error state if roster or stats fetch fails
- [ ] xwOBA gracefully falls back to wOBA if not available

## Out of Scope

- Player headshots or profile images (keep design minimal)
- Drill-down to individual player detail pages (link only, no implementation)
- Filtering or search (sortable headers cover discovery)
- Season dropdown or date picker (use existing game context)

## Success Criteria

- All active roster players with stats are displayed in a single, sortable table per team
- Table is organized by position (SP, RP, then infielders, then outfielders)
- Sabermetric columns are color-graded; seasonal stats are neutral
- Mobile experience is usable (no horizontal scroll of critical columns)
- Section loads with Suspense boundary, same as current SaberSection
