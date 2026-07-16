"use client";

import { useMemo, useState } from "react";

interface SortState {
  sortKey: string;
  direction: "asc" | "desc";
}

interface UseSortableTableOptions<T> {
  data: T[];
  defaultSortKey: keyof T;
  defaultDirection?: "asc" | "desc";
}

export function useSortableTable<T>({
  data,
  defaultSortKey,
  defaultDirection = "desc",
}: UseSortableTableOptions<T>) {
  const [sort, setSort] = useState<SortState>({
    sortKey: String(defaultSortKey),
    direction: defaultDirection,
  });

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      let aVal: unknown = a;
      let bVal: unknown = b;

      // Navigate nested paths (e.g., "split.ops")
      const keys = sort.sortKey.split(".");
      for (const key of keys) {
        aVal = aVal != null ? (aVal as Record<string, unknown>)[key] : null;
        bVal = bVal != null ? (bVal as Record<string, unknown>)[key] : null;
      }

      // Handle nullish values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sort.direction === "asc" ? 1 : -1;
      if (bVal == null) return sort.direction === "asc" ? -1 : 1;

      // Numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        const result = aVal - bVal;
        return sort.direction === "asc" ? result : -result;
      }

      // String comparison (and numeric strings)
      if (typeof aVal === "string" && typeof bVal === "string") {
        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          const result = aNum - bNum;
          return sort.direction === "asc" ? result : -result;
        }
        const result = aVal.localeCompare(bVal);
        return sort.direction === "asc" ? result : -result;
      }

      return 0;
    });
    return copy;
  }, [data, sort]);

  const toggleSort = (key: string) => {
    if (sort.sortKey === key) {
      setSort((s) => ({
        ...s,
        direction: s.direction === "asc" ? "desc" : "asc",
      }));
    } else {
      setSort({ sortKey: key, direction: "desc" });
    }
  };

  return { sorted, sort, toggleSort };
}
