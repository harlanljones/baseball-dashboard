import PlayerHeadshot from "./PlayerHeadshot";

export interface SaberStat {
  label: string;
  value: string;
  /** Optional grading class from `statClass` (red = good, blue = bad). */
  className?: string;
}

/** Compact player card showing a handful of sabermetric stats. */
export default function SaberCard({
  name,
  subtitle,
  stats,
  headshotId,
}: {
  name: string;
  subtitle?: string;
  stats: SaberStat[];
  headshotId?: number;
}) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper p-3">
      <div className="mb-2 flex items-center gap-2">
        {headshotId != null && <PlayerHeadshot personId={headshotId} size={32} />}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          {subtitle && (
            <p className="truncate text-xs text-ink/50">{subtitle}</p>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {stats.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between">
            <dt className="text-xs text-ink/50">{s.label}</dt>
            <dd
              className={`font-mono -mx-1 rounded-sm px-1 text-sm font-medium ${s.className ?? ""}`}
            >
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
