"use client";

/**
 * Renders a changing value with a short pop when the number actually changes,
 * so a live score tick or a lean that reorders under a slider drag draws the
 * eye. A `key` remount (not state) replays the CSS animation, and
 * `prefers-reduced-motion` disables it entirely.
 */
export default function ScorePop({
  value,
  className = "",
}: {
  value: string | number;
  className?: string;
}) {
  return (
    <span key={String(value)} className={`score-pop ${className}`}>
      {value}
    </span>
  );
}
