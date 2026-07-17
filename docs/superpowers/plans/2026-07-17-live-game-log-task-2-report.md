# Task 2: Implement getGamePlays() Function — Report

**Date:** 2026-07-17  
**Status:** ✅ DONE  
**Commit Hash:** 98d75ed

---

## What Was Done (Step-by-Step)

### Step 1: Add Raw Play Type Definitions ✅
Added five new TypeScript interfaces to `src/lib/mlb/game.ts` after the existing `RawFeed` interface:
- `RawRunner` — shape for runner/score data with `home_teamRuns` and `away_teamRuns` optional fields
- `RawResult` — shape for play result with `eventType` and `description`
- `RawAbout` — shape for inning metadata with `inning` (number) and `halfInning` (string, "Top"/"Bottom")
- `RawPlay` — main shape for a single play, containing `about`, `result`, `runners`, and `matchup` (with batter/pitcher refs)
- `RawFeedWithPlays` — extends `RawFeed` with a `plays` array in `liveData`

All types follow the minimal field approach (optional fields only where needed).

### Step 2: Add mapEventType() Helper Function ✅
Implemented the event type mapper function at line 210-228 in `src/lib/mlb/game.ts`:
- Maps raw MLB event type strings (e.g., "home_run", "stolen_base") to our `ScoringPlayEventType` enum values
- Uses exact string matching for simple types (home_run, single, double, triple, error)
- Uses `.includes()` for compound types (stolen_base, caught_stealing)
- Returns `null` if the event type doesn't match any significant play type
- Type signature: `(rawType: string | undefined): ScoringPlayEventType | null`

### Step 3: Add isSignificantPlay() Helper Function ✅
Implemented the significance filter at line 230-254 in `src/lib/mlb/game.ts`:
- Checks if a play has an eventType from the result
- Maintains a hardcoded list of significant event types to match against
- Uses both exact and substring matching (to handle variants like "stolen_base_home")
- Double-checks with `mapEventType()` to ensure it's a recognized type
- Returns `boolean` indicating if the play should be included

### Step 4: Import Updated Types ✅
Updated the import statement at the top of `src/lib/mlb/game.ts` (lines 3-14) to include:
- `ScoringPlay` — the output interface
- `ScoringPlayEventType` — the enum type for event classifications

These are imported from `"./types"` alongside existing imports.

### Step 5: Implement getGamePlays() Export Function ✅
Added the main public export function at line 344-382 in `src/lib/mlb/game.ts`:
- **Signature:** `export async function getGamePlays(gamePk: number): Promise<ScoringPlay[]>`
- Fetches from `/api/v1.1/game/${gamePk}/feed/live` using `mlbFetch<RawFeedWithPlays>()` with `TTL.live` caching
- Returns empty array if `feed.liveData.plays` is undefined
- Chains `.filter(isSignificantPlay)` to exclude unimportant plays
- Maps filtered plays to `ScoringPlay` objects with proper type construction:
  - `inning`: from `play.about?.inning`
  - `ordinal`: mapped from `halfInning` ("Top" or "Bottom")
  - `batter`/`pitcher`: converted to `PlayerRef` objects if present
  - `description`: from `play.result?.description`
  - `eventType`: result of `mapEventType()`
  - `awayScore`/`homeScore`: extracted from the last runner in the runners array
- Filters out any null entries from the map step using a type guard: `.filter((p): p is ScoringPlay => p !== null)`
- Returns the final array of `ScoringPlay[]`

---

## Questions/Concerns Before Implementation

None — the plan was explicit and complete. All code blocks were provided, types were ready (Task 1 complete), and the data model was clear from the interfaces.

---

## TypeScript Compilation Status

The file compiles without errors specific to the new code. Pre-existing TypeScript configuration issues in the project do not affect this module:

```
✅ src/lib/mlb/game.ts compiles successfully
✅ All types are properly imported and used
✅ No new TypeScript errors introduced
```

(Note: The project has pre-existing TS errors in `client.ts` and `schedule.ts` unrelated to this work.)

---

## Commit Hash

- **Hash:** `98d75ed`
- **Message:** `feat: add getGamePlays() function to fetch significant plays`
- **Files Changed:** 1 (`src/lib/mlb/game.ts`)
- **Insertions:** 123 lines

---

## Self-Review Notes

### Code Quality
- ✅ Helper functions are pure and testable
- ✅ Event type mapping is consistent with ScoringPlayEventType enum
- ✅ Proper null/undefined handling with optional chaining and fallbacks
- ✅ Filter logic is clear: significant events → mapped → non-null

### Type Safety
- ✅ All new types are properly defined with optional fields
- ✅ `mapEventType()` return type is explicit (`ScoringPlayEventType | null`)
- ✅ `ScoringPlay` object construction matches interface exactly
- ✅ Type guard in final filter is correctly placed: `(p): p is ScoringPlay => p !== null`

### API Integration
- ✅ Uses existing `mlbFetch()` helper with proper typing
- ✅ Uses `TTL.live` for cache invalidation (short TTL for live data)
- ✅ Endpoint path matches plan: `/api/v1.1/game/${gamePk}/feed/live`
- ✅ Graceful empty-array fallback if plays are missing

### Dependency Chain
- ✅ Depends on Task 1 (ScoringPlay types) — already complete
- ✅ Exported for use by Task 4 (GameLogSection component)
- ✅ No circular dependencies introduced

### Documentation
- ✅ JSDoc comment describes purpose and return type
- ✅ Inline comments explain score extraction logic
- ✅ Code is self-documenting (function/variable names are clear)

---

## Next Steps

Task 2 is complete and ready for Task 3 (GameLog component). All dependencies are satisfied:
- ✅ Type definitions available
- ✅ Data fetching function exported
- ✅ Helper functions in place and tested via TypeScript checking

Task 3 can now proceed with importing `ScoringPlay[]` and building the display component.
