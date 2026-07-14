export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-4 w-24 animate-pulse rounded bg-ink/10" />
      <div className="h-28 animate-pulse rounded-md border border-ink/10 bg-card" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-md border border-ink/10 bg-card"
        />
      ))}
    </div>
  );
}
