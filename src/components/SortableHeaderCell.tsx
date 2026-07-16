interface SortableHeaderCellProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  currentDirection: "asc" | "desc";
  onSort: (key: string) => void;
  title?: string;
}

export default function SortableHeaderCell({
  label,
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  title,
}: SortableHeaderCellProps) {
  const isActive = currentSortKey === sortKey;
  const arrow = isActive ? (currentDirection === "desc" ? " ↓" : " ↑") : "";

  return (
    <th
      scope="col"
      title={title}
      className="font-display px-2 py-1 text-right text-xs font-semibold uppercase tracking-wider text-ink/50 cursor-pointer hover:text-ink/80 transition-colors"
      onClick={() => onSort(sortKey)}
    >
      {label}
      {arrow}
    </th>
  );
}
