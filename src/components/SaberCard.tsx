export interface SaberStat {
  label: string;
  value: string;
}

/** Compact player card showing a handful of sabermetric stats. */
export default function SaberCard({
  name,
  subtitle,
  stats,
}: {
  name: string;
  subtitle?: string;
  stats: SaberStat[];
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2">
        <p className="truncate text-sm font-semibold">{name}</p>
        {subtitle && (
          <p className="truncate text-xs text-neutral-500">{subtitle}</p>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between">
            <dt className="text-xs text-neutral-500">{s.label}</dt>
            <dd className="nums text-sm font-medium">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
