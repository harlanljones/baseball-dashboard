/**
 * One-line legend for hot/cold stat grading, rendered once per section whose
 * tables carry graded cells. Pairs the cell triangles with words so the
 * encoding never rides on color alone.
 */
export default function StatGradeLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink/65 ${className}`}>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="text-hot-deep">▲</span> Hot: well above average
      </span>
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="text-cold">▼</span> Cold: well below average
      </span>
    </p>
  );
}
