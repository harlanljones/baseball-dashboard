"use client";

interface SortableHeaderCellProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  currentDirection: "asc" | "desc";
  onSort: (key: string) => void;
  title?: string;
  align?: "left" | "right";
}

/**
 * The one sortable-header implementation: a real button inside the th, so
 * sorting works from the keyboard and screen readers announce column state
 * via aria-sort. The th carries `group` so the hover affordance tracks the
 * whole header cell, not just the label.
 */
export default function SortableHeaderCell({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  title,
  align = "right",
}: SortableHeaderCellProps) {
  const isActive = currentSortKey === sortKey;
  const arrow = currentDirection === "desc" ? "↓" : "↑";

  return (
    <th
      scope="col"
      aria-sort={isActive ? (currentDirection === "asc" ? "ascending" : "descending") : undefined}
      title={title}
      className={`font-display group px-2.5 py-2 text-xs font-semibold uppercase tracking-wider ${
        align === "left" ? "text-left" : "text-right"
      } ${isActive ? "text-ink" : "text-ink/65"}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex cursor-pointer items-center gap-0.5 uppercase tracking-wider transition-colors hover:text-ink focus-visible:outline focus-visible:outline-grass"
      >
        {label}
        {isActive ? (
          <span aria-hidden className="text-grass">
            {arrow}
          </span>
        ) : (
          <span
            aria-hidden
            className="text-ink/0 transition-colors group-hover:text-ink/65"
          >
            ↕
          </span>
        )}
      </button>
    </th>
  );
}
