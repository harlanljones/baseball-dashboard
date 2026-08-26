import { DEFAULT_WEIGHTS } from "@/lib/odds/board";

/**
 * Reserved slot for {@link BestLeansSection} while its prop board loads.
 *
 * The header is the real one — its copy is static, so the section can name
 * itself immediately and only the data reads as pending. Each placeholder row
 * mirrors the resolved row's markup exactly (same grid, same type classes,
 * same padding) with the text merely made transparent, so the reserved height
 * matches what arrives rather than approximating it. That is what keeps the
 * games grid below from moving when the leans land.
 */

/** Stand-in strings, sized like real leans so the bars vary as content does. */
const ROWS = [
  { name: "Shohei Ohtani", teams: "LAD at SDP", market: "Total bases 1.5" },
  { name: "Aaron Judge", teams: "NYY at BOS", market: "Home runs 0.5" },
  { name: "Tarik Skubal", teams: "DET at CLE", market: "Strikeouts 6.5" },
  { name: "Bobby Witt Jr.", teams: "KCR at MIN", market: "Hits 1.5" },
  { name: "Corbin Carroll", teams: "ARI at COL", market: "RBIs 0.5" },
];

/** Transparent text on a tinted plate — a bar the exact size of its content. */
const bar = "rounded-sm bg-ink/10 text-transparent";

/**
 * The five placeholder rows, on their own so the empty state can mount the
 * same block invisibly and inherit its exact height at every width. A magic
 * pixel value could not track how these rows wrap on a narrow screen.
 */
export function LeansRowBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`mt-3 divide-y divide-ink/10 border-y border-ink/10 ${className}`.trim()}
    >
      {ROWS.map((row) => (
        <div
          key={row.name}
          className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-1 py-3"
        >
          <span className="h-7 w-7 shrink-0 rounded-full bg-ink/10" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className={`font-display font-semibold ${bar}`}>{row.name}</span>
              <span className={`text-xs ${bar}`}>{row.teams}</span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs">
              <span className="rounded-sm border border-ink/10 bg-ink/10 px-1 py-px text-xs font-semibold uppercase tracking-wider text-transparent">
                over
              </span>
              <span className={bar}>{row.market}</span>
              <span className={`nums font-mono ${bar}`}>-115</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`nums font-mono text-lg font-semibold ${bar}`}>00.0</span>
            <span className="text-transparent">→</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** The header both the skeleton and the resolved states share, verbatim. */
export function LeansHeader({ note }: { note: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="eyebrow text-base">Best leans across the slate</h2>
        <p className="mt-1 text-xs text-ink/65">
          Default weights: confidence {DEFAULT_WEIGHTS.modelConfidence}% · edge{" "}
          {DEFAULT_WEIGHTS.statisticalEdge}% · value {DEFAULT_WEIGHTS.marketValue}%
        </p>
      </div>
      <span className="text-xs text-ink/65">{note}</span>
    </div>
  );
}

export default function BestLeansSkeleton() {
  return (
    <section
      role="status"
      className="mb-5 rounded-md border border-ink/10 bg-card p-4 shadow-sm"
    >
      <LeansHeader note="Reading the slate…" />
      <span className="sr-only">Loading best leans across the slate</span>
      <LeansRowBlock className="animate-pulse" />
    </section>
  );
}
