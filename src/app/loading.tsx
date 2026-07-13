export default function Loading() {
  return (
    <div>
      <div className="mb-5 h-10 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
          />
        ))}
      </div>
    </div>
  );
}
