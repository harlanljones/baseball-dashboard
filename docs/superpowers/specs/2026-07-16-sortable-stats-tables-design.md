# Sortable Stats Tables Design

**Date:** 2026-07-16  
**Scope:** Add interactive column sorting to bullpen, matchup, and split stats tables with sensible defaults.

---

## Overview

Stats tables across the game detail page (bullpen, matchup career/platoon splits, and home/away fallback) will become sortable via clickable column headers. Each table defaults to a specific sort column, which users can override by clicking headers. Sort direction toggles on repeated clicks.

---

## Affected Tables

### 1. Bullpen Stats (Bullpen.tsx)
- **Location:** `src/components/Bullpen.tsx` → `BullpenTable`
- **Columns:** IP, ERA, WHIP, K, PY, P3D
- **Default sort:** IP (descending) — shows most-active pitchers first
- **Highlighted columns:** ERA, WHIP (use `statClass` for red/blue background)
- **Sortable:** All columns except Pitcher name

### 2. Matchup Split Tables (MatchupTable.tsx)
Two scenarios, both affected:

#### a) When Pitcher Exists
- **Location:** `src/components/MatchupTable.tsx` → main table + platoon split table
- **Career table columns:** PA, H, HR, BB, K, AVG, OBP, SLG
  - **Default sort:** N/A (currently doesn't need sorting; career data is historical)
  - **Highlighted:** AVG, OBP, SLG (use `rateClass` with PA threshold)
  
- **Platoon split table columns:** PA, OBP, OPS, BB%, K%
  - **Default sort:** OPS (descending) — shows best matchups first
  - **Highlighted:** OBP, OPS, BB%, K% (use `rateClass` with PA threshold)

#### b) When No Pitcher (NoPitcherSplits)
- **Location:** `src/components/MatchupTable.tsx` → `NoPitcherSplits`
- **Columns:** PA, OBP, OPS, BB%, K%
- **Default sort:** OPS (descending) — shows best hitters for this split first
- **Highlighted:** OBP, OPS, BB%, K% (use `rateClass` with PA threshold)

---

## Implementation Details

### Sorting Logic

**Reusable hook: `useSortableTable`**
```typescript
// src/lib/hooks/useSortableTable.ts
interface UseSortableTableOptions<T> {
  data: T[];
  defaultSortKey: keyof T;
  defaultDirection?: 'asc' | 'desc';
  compareFn?: (a: T, b: T, key: keyof T, dir: 'asc' | 'desc') => number;
}

interface SortState {
  sortKey: string;
  direction: 'asc' | 'desc';
}

export function useSortableTable<T>({
  data,
  defaultSortKey,
  defaultDirection = 'desc',
  compareFn,
}: UseSortableTableOptions<T>) {
  const [sort, setSort] = useState<SortState>({
    sortKey: String(defaultSortKey),
    direction: defaultDirection,
  });

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      // numeric comparison for numeric fields, string for others
      // respects sort direction
    });
  }, [data, sort]);

  const toggleSort = (key: string) => {
    if (sort.sortKey === key) {
      setSort((s) => ({
        ...s,
        direction: s.direction === 'asc' ? 'desc' : 'asc',
      }));
    } else {
      setSort({ sortKey: key, direction: 'desc' });
    }
  };

  return { sorted, sort, toggleSort };
}
```

### Header Rendering

**Sortable header component: `SortableHeaderCell`**
```typescript
// src/components/SortableHeaderCell.tsx
interface SortableHeaderCellProps {
  label: string;
  sortKey: string;
  isActive: boolean;
  direction?: 'asc' | 'desc';
  onSort: (key: string) => void;
}

// Renders as: "COLUMN ↓" or "COLUMN ↑" when active, plain text when inactive
// Cursor: pointer, hover underline to indicate clickability
```

### Column-Specific Handling

- **Numeric columns** (IP, ERA, WHIP, K, PA, OPS, etc.): standard numeric sort
- **String columns** (names): case-insensitive alphabetic sort
- **Percentage columns** (BB%, K%): parse float, numeric sort
- **Pitcher/Batter names:** not sortable (remain first column)

### Visual Indicators

- **Active sort column:** shows arrow (↓ for desc, ↑ for asc) in header
- **Hover state:** cursor pointer, slight text underline
- **Inactive headers:** normal text, no arrow
- **Arrow styling:** use same text color as header (`text-ink/50`)

---

## Data Flow

1. Table component receives data (bullpen array, rows array, etc.)
2. `useSortableTable` hook is called with data + default sort config
3. Hook returns sorted data + `toggleSort` callback
4. Headers render with `SortableHeaderCell`, pass `toggleSort` as onClick
5. User clicks header → `toggleSort` fires → state updates → table re-renders with new sort

---

## Affected Files

- `src/components/Bullpen.tsx` — modify `BullpenTable` to use `useSortableTable`
- `src/components/MatchupTable.tsx` — modify `MatchupTable` (platoon split table) and `NoPitcherSplits` to use hook
- `src/lib/hooks/useSortableTable.ts` — new file, reusable hook
- `src/components/SortableHeaderCell.tsx` — new component for sortable headers

---

## Highlights Remain Unchanged

Red/blue highlighting via `statClass` (ERA, WHIP in bullpen) and `rateClass` (OBP, OPS, BB%, K% in splits with PA threshold) is already applied. Sorting does not affect highlighting logic.

---

## Testing Considerations

- Click headers to toggle sort direction and switch columns
- Verify default sort is applied on page load
- Check that highlighting is preserved after sort
- Verify small sample sizes (low PA) don't get incorrectly colored in splits
- Confirm sort works with missing data (dashes, nulls)

---

## Browser Compatibility

Client-side sorting via `useMemo` and React state — works in all modern browsers. No external sort library needed.
