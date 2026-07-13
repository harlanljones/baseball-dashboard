export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-28 animate-pulse rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
        />
      ))}
    </div>
  );
}
