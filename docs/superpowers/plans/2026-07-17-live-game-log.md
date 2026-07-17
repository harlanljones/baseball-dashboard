# Live Game Log Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a live game log section that displays significant plays grouped by inning, and hide pitchers' batting lines from the boxscore during live games.

**Architecture:** Extend the GameFeed data layer with a separate `getGamePlays()` function that fetches and filters play-by-play data, create a `GameLog` component for rendering grouped plays, and integrate via Suspense in the game detail page. Modify `BoxscoreTables` to conditionally hide pitcher batting lines.

**Tech Stack:** TypeScript, React, MLB Stats API (existing feed/live endpoint)

## Global Constraints

- Only hide pitcher batting lines when `feed.state === "Live"`
- Significant events: runs scored, stolen bases, caught stealing, errors, sacrifices, wild pitches, balks
- Game log placement: after boxscore, before other sections
- Lazy-load via Suspense (independent of boxscore)

---

## File Structure

**Modified:**
- `src/lib/mlb/types.ts` — add `ScoringPlay` and `ScoringPlayEventType` types
- `src/lib/mlb/game.ts` — add `getGamePlays()` function
- `src/components/BoxscoreTables.tsx` — add `isLive` prop, filter pitcher batting lines
- `src/app/games/[gamePk]/page.tsx` — integrate GameLogSection with Suspense

**Created:**
- `src/components/GameLog.tsx` — render plays grouped by inning
- `src/components/GameLogSection.tsx` — async server component, fetches plays, error handling

---

## Tasks

### Task 1: Add ScoringPlay Types

**Files:**
- Modify: `src/lib/mlb/types.ts` (end of file)

**Interfaces:**
- Produces: `ScoringPlay` interface and `ScoringPlayEventType` type union (used by `getGamePlays()` and `GameLog`)

- [ ] **Step 1: Add types to end of types.ts**

Append to `src/lib/mlb/types.ts` after the `MatchupSide` interface:

```typescript
// ---------------------------------------------------------------------------
// Game log (play-by-play events)
// ---------------------------------------------------------------------------

export type ScoringPlayEventType =
  | "home_run"
  | "single"
  | "double"
  | "triple"
  | "stolen_base"
  | "caught_stealing"
  | "error"
  | "sacrifice_bunt"
  | "sacrifice_fly"
  | "wild_pitch"
  | "passed_ball"
  | "balk";

export interface ScoringPlay {
  inning: number;           // 1-based
  ordinal: string;          // "Top" | "Bottom"
  batter?: PlayerRef;       // Who was batting
  pitcher?: PlayerRef;      // Who was pitching
  description: string;      // Event description from API
  eventType: ScoringPlayEventType;
  awayScore: number;        // Score after this play
  homeScore: number;
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /mnt/c/Users/harlan/GitHub/baseball-dashboard && npm run type-check 2>&1 | head -20`

Expected: No errors related to types.ts

- [ ] **Step 3: Commit**

```bash
git.exe add src/lib/mlb/types.ts
git.exe commit -m "types: add ScoringPlay and ScoringPlayEventType for game log"
```

---

### Task 2: Implement getGamePlays() Function

**Files:**
- Modify: `src/lib/mlb/game.ts`

**Interfaces:**
- Consumes: `ScoringPlay`, `ScoringPlayEventType` from Task 1
- Produces: `getGamePlays(gamePk: number): Promise<ScoringPlay[]>` exported function

- [ ] **Step 1: Add raw play type definitions to game.ts**

Add to `src/lib/mlb/game.ts` after the existing `RawFeed` interface (around line 82):

```typescript
interface RawRunner {
  home_teamRuns?: number;
  away_teamRuns?: number;
}

interface RawResult {
  eventType?: string;
  description?: string;
}

interface RawAbout {
  inning?: number;
  halfInning?: string; // "Top" or "Bottom"
}

interface RawPlay {
  about?: RawAbout;
  result?: RawResult;
  runners?: RawRunner[];
  matchup?: {
    batter?: RawPersonRef;
    pitcher?: RawPersonRef;
  };
}

interface RawFeedWithPlays extends RawFeed {
  liveData: RawFeed["liveData"] & {
    plays?: RawPlay[];
  };
}
```

- [ ] **Step 2: Add helper function to map MLB event types to ScoringPlayEventType**

Add this function to `src/lib/mlb/game.ts` before `getGamePlays()`:

```typescript
function mapEventType(rawType: string | undefined): ScoringPlayEventType | null {
  if (!rawType) return null;

  // Map raw MLB event types to our types
  if (rawType === "home_run") return "home_run";
  if (rawType === "single") return "single";
  if (rawType === "double") return "double";
  if (rawType === "triple") return "triple";
  if (rawType.includes("stolen_base")) return "stolen_base";
  if (rawType.includes("caught_stealing")) return "caught_stealing";
  if (rawType === "error") return "error";
  if (rawType === "sacrifice_bunt") return "sacrifice_bunt";
  if (rawType === "sacrifice_fly") return "sacrifice_fly";
  if (rawType === "wild_pitch") return "wild_pitch";
  if (rawType === "passed_ball") return "passed_ball";
  if (rawType === "balk") return "balk";

  return null;
}
```

- [ ] **Step 3: Add helper function to check if a play is significant**

Add this function to `src/lib/mlb/game.ts` after `mapEventType()`:

```typescript
function isSignificantPlay(play: RawPlay): boolean {
  const eventType = play.result?.eventType;
  if (!eventType) return false;

  // Check if it's one of our significant event types
  const significant = [
    "home_run",
    "single",
    "double",
    "triple",
    "stolen_base",
    "caught_stealing",
    "error",
    "sacrifice_bunt",
    "sacrifice_fly",
    "wild_pitch",
    "passed_ball",
    "balk",
  ];

  return (
    significant.some((s) => eventType === s || eventType.includes(s)) &&
    mapEventType(eventType) !== null
  );
}
```

- [ ] **Step 4: Implement getGamePlays() function**

Add to `src/lib/mlb/game.ts` after the helper functions and before the closing export:

```typescript
/**
 * Fetch significant plays (scoring events, steals, errors, etc.) for a game.
 * Returns plays grouped by inning and half.
 */
export async function getGamePlays(gamePk: number): Promise<ScoringPlay[]> {
  const feed = await mlbFetch<RawFeedWithPlays>(
    `/api/v1.1/game/${gamePk}/feed/live`,
    {},
    TTL.live,
  );

  if (!feed.liveData.plays) return [];

  const plays = feed.liveData.plays
    .filter(isSignificantPlay)
    .map((play): ScoringPlay | null => {
      const eventType = mapEventType(play.result?.eventType);
      if (!eventType) return null;

      // Find the final score after this play
      const finalRunner = play.runners?.[play.runners.length - 1];
      const awayScore = finalRunner?.away_teamRuns ?? 0;
      const homeScore = finalRunner?.home_teamRuns ?? 0;

      return {
        inning: play.about?.inning ?? 0,
        ordinal: play.about?.halfInning === "Top" ? "Top" : "Bottom",
        batter: play.matchup?.batter
          ? { id: play.matchup.batter.id, fullName: play.matchup.batter.fullName }
          : undefined,
        pitcher: play.matchup?.pitcher
          ? { id: play.matchup.pitcher.id, fullName: play.matchup.pitcher.fullName }
          : undefined,
        description: play.result?.description ?? "",
        eventType,
        awayScore,
        homeScore,
      };
    })
    .filter((p): p is ScoringPlay => p !== null);

  return plays;
}
```

- [ ] **Step 5: Import types at top of game.ts**

Update the import statement at the top of `src/lib/mlb/game.ts` to include the new types:

```typescript
import type {
  BoxscoreBatter,
  BoxscorePitcher,
  BullpenPitcher,
  GameFeed,
  InningLine,
  PlayerRef,
  ScoringPlay,
  ScoringPlayEventType,
  TeamBoxscore,
  TeamRef,
} from "./types";
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npm run type-check 2>&1 | head -20`

Expected: No errors

- [ ] **Step 7: Commit**

```bash
git.exe add src/lib/mlb/game.ts
git.exe commit -m "feat: add getGamePlays() function to fetch significant plays"
```

---

### Task 3: Create GameLog Component

**Files:**
- Create: `src/components/GameLog.tsx`

**Interfaces:**
- Consumes: `ScoringPlay[]` (from Task 2)
- Produces: GameLog React component exported as default

- [ ] **Step 1: Create GameLog component file**

Create `src/components/GameLog.tsx`:

```typescript
import type { ScoringPlay } from "@/lib/mlb/types";

function gameLogKey(inning: number, ordinal: string): string {
  return `${inning}-${ordinal}`;
}

export default function GameLog({ plays }: { plays: ScoringPlay[] }) {
  // Group plays by inning and ordinal
  const grouped = new Map<string, ScoringPlay[]>();
  for (const play of plays) {
    const key = gameLogKey(play.inning, play.ordinal);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(play);
  }

  // Render inning cards in order
  const inningKeys = Array.from(grouped.keys()).sort((a, b) => {
    const [aInning, aOrdinal] = a.split("-");
    const [bInning, bOrdinal] = b.split("-");
    const ainningNum = parseInt(aInning, 10);
    const binningNum = parseInt(bInning, 10);
    if (ainningNum !== binningNum) return ainningNum - binningNum;
    // Top before Bottom
    return aOrdinal === "Top" ? -1 : 1;
  });

  return (
    <div className="space-y-3">
      {inningKeys.length === 0 && (
        <p className="text-sm text-ink/60">No scoring plays yet.</p>
      )}
      {inningKeys.map((key) => {
        const inningPlays = grouped.get(key)!;
        const [inning, ordinal] = key.split("-");
        return (
          <div
            key={key}
            className="rounded-md border border-ink/10 bg-card p-3 shadow-sm"
          >
            <h3 className="font-display mb-2 text-sm font-semibold text-ink/80">
              {ordinal} {inning}
            </h3>
            <ul className="space-y-1">
              {inningPlays.map((play, idx) => (
                <li key={idx} className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex-1 text-ink/80">
                      • {play.description}
                    </span>
                    <span className="whitespace-nowrap font-mono text-xs text-ink/60">
                      {play.awayScore}-{play.homeScore}{" "}
                      {play.awayScore > play.homeScore
                        ? "Away"
                        : play.homeScore > play.awayScore
                          ? "Home"
                          : "Tied"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify component renders without errors**

Check TypeScript compilation:

Run: `npm run type-check 2>&1 | grep -i "gamelog\|error" | head -10`

Expected: No GameLog-related errors

- [ ] **Step 3: Commit**

```bash
git.exe add src/components/GameLog.tsx
git.exe commit -m "feat: add GameLog component to display plays grouped by inning"
```

---

### Task 4: Create GameLogSection Async Component

**Files:**
- Create: `src/components/GameLogSection.tsx`

**Interfaces:**
- Consumes: `GameFeed` (used to get gamePk), `getGamePlays()` from Task 2
- Produces: GameLogSection async server component (renders GameLog or error)

- [ ] **Step 1: Create GameLogSection component file**

Create `src/components/GameLogSection.tsx`:

```typescript
import GameLog from "./GameLog";
import type { GameFeed } from "@/lib/mlb/types";
import { getGamePlays } from "@/lib/mlb/game";

function SectionError({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
      Couldn't load {label} right now.
    </p>
  );
}

export default async function GameLogSection({ feed }: { feed: GameFeed }) {
  try {
    const plays = await getGamePlays(feed.gamePk);
    return <GameLog plays={plays} />;
  } catch (error) {
    console.error("Failed to fetch game plays:", error);
    return <SectionError label="game log" />;
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npm run type-check 2>&1 | grep -i "logsection\|error" | head -10`

Expected: No GameLogSection-related errors

- [ ] **Step 3: Commit**

```bash
git.exe add src/components/GameLogSection.tsx
git.exe commit -m "feat: add GameLogSection async component with error handling"
```

---

### Task 5: Modify BoxscoreTables to Hide Pitcher Batting Lines for Live Games

**Files:**
- Modify: `src/components/BoxscoreTables.tsx`

**Interfaces:**
- Consumes: `isLive?: boolean` prop (new)
- Produces: same component with conditional rendering

- [ ] **Step 1: Add isLive prop type**

Modify `src/components/BoxscoreTables.tsx` function signature (around line 19):

Change:
```typescript
function TeamBox({ box }: { box: TeamBoxscore }) {
```

To:
```typescript
function TeamBox({ box, isLive }: { box: TeamBoxscore; isLive?: boolean }) {
```

- [ ] **Step 2: Filter batters array when isLive is true**

In the same `TeamBox` component, add this before the return statement (after line 21):

```typescript
  // When game is live, exclude pitchers from batting table
  const displayBatters = isLive
    ? box.batters.filter((b) => !box.pitcherIds.includes(b.id))
    : box.batters;
```

- [ ] **Step 3: Update batters map to use displayBatters**

In the table body (around line 40), change:

```typescript
            {box.batters.map((b) => (
```

To:

```typescript
            {displayBatters.map((b) => (
```

- [ ] **Step 4: Update BoxscoreTables component signature**

At the top-level `BoxscoreTables` component (around line 19), change:

```typescript
export default function BoxscoreTables({
  away,
  home,
}: {
  away: TeamBoxscore;
  home: TeamBoxscore;
}) {
```

To:

```typescript
export default function BoxscoreTables({
  away,
  home,
  isLive,
}: {
  away: TeamBoxscore;
  home: TeamBoxscore;
  isLive?: boolean;
}) {
```

- [ ] **Step 5: Pass isLive prop to TeamBox components**

Update the two `TeamBox` calls (around lines 22-24), change:

```typescript
      <TeamBox box={away} />
      {/* ... */}
      <TeamBox box={home} />
```

To:

```typescript
      <TeamBox box={away} isLive={isLive} />
      {/* ... */}
      <TeamBox box={home} isLive={isLive} />
```

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npm run type-check 2>&1 | grep -i "boxscore\|error" | head -10`

Expected: No BoxscoreTables-related errors

- [ ] **Step 7: Commit**

```bash
git.exe add src/components/BoxscoreTables.tsx
git.exe commit -m "feat: add isLive prop to BoxscoreTables to hide pitcher batting lines"
```

---

### Task 6: Integrate GameLogSection into Game Detail Page

**Files:**
- Modify: `src/app/games/[gamePk]/page.tsx`

**Interfaces:**
- Consumes: `GameLogSection` component (Task 4), `isLive` prop for BoxscoreTables (Task 5)
- Produces: same page with new section and modified boxscore

- [ ] **Step 1: Add GameLogSection import**

At the top of `src/app/games/[gamePk]/page.tsx` with other imports (around line 17), add:

```typescript
import GameLogSection from "@/components/GameLogSection";
```

- [ ] **Step 2: Update BoxscoreTables call to pass isLive**

Find the BoxscoreTables call (around line 356) and change:

```typescript
            <BoxscoreTables away={feed.boxscore.away} home={feed.boxscore.home} />
```

To:

```typescript
            <BoxscoreTables
              away={feed.boxscore.away}
              home={feed.boxscore.home}
              isLive={feed.state === "Live"}
            />
```

- [ ] **Step 3: Add GameLog section after boxscore**

After the boxscore Section (around line 359), add:

```typescript
      {/* Game log */}
      {scored && !isDisrupted && (
        <Section title="Game log">
          <Suspense fallback={<SectionSkeleton />}>
            <GameLogSection feed={feed} />
          </Suspense>
        </Section>
      )}
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npm run type-check 2>&1 | head -20`

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git.exe add src/app/games/[gamePk]/page.tsx
git.exe commit -m "feat: integrate GameLogSection into game detail page after boxscore"
```

---

### Task 7: Manual End-to-End Test

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

Run:
```bash
cd /mnt/c/Users/harlan/GitHub/baseball-dashboard
npm run dev
```

Expected: Dev server starts at `localhost:3000` (or similar)

- [ ] **Step 2: Find and load a live game**

In browser, navigate to the app and find a game with `state === "Live"`. If none exist:
- Go to `/` and look for games in progress
- Or manually construct URL like `http://localhost:3000/games/ABC123` where ABC123 is a known live game pk

Expected: Game detail page loads

- [ ] **Step 3: Verify pitcher batting lines are hidden**

In the "Boxscore" section, check the batting table for each team:
- Pitchers should NOT appear in the batting table (scroll through batter names)
- Pitchers table below should still show pitching stats

Expected: Batters table shows only batters (verify by position or name), no pitchers

- [ ] **Step 4: Verify game log appears with plays**

Below the boxscore, check the "Game log" section:
- Section should be visible (not loading spinner)
- Should show one or more inning cards (e.g., "Top 1", "Bottom 1")
- Each inning card lists plays with description and score

Expected: Game log shows "Top 1: [play description] | 1-0 Away" format with correct scores

- [ ] **Step 5: Verify Suspense fallback (optional)**

If game log is slow to load:
- You should see a skeleton loader (SectionSkeleton) briefly before plays appear
- No errors in browser console

Expected: Skeleton appears, then game log renders

- [ ] **Step 6: Load a Final game**

Navigate to a completed game (state === "Final"):

Expected: Same layout — boxscore shows all batters including pitchers (isLive=false), game log shows all plays

---

## Self-Review

**Spec Coverage:**
- ✅ Pitcher removal from batting boxscore when live (Task 5)
- ✅ Game log with significant plays (Task 3-4, 6)
- ✅ Inning-grouped display (Task 3 grouping logic)
- ✅ Lazy-loaded via Suspense (Task 6 integration)
- ✅ Placement after boxscore (Task 6)
- ✅ Data layer with getGamePlays() (Task 2)
- ✅ Types added (Task 1)

**Placeholders:** None detected. All steps have complete code or exact commands.

**Type Consistency:**
- `ScoringPlay` defined in Task 1, used in Tasks 2, 3, 4 ✅
- `getGamePlays()` defined in Task 2, used in Task 4, 6 ✅
- `GameLog` component created in Task 3, used in Task 4 ✅
- `GameLogSection` created in Task 4, used in Task 6 ✅
- `isLive` prop added to BoxscoreTables in Task 5, passed in Task 6 ✅

**No Gaps:** All requirements from spec are covered by at least one task.
