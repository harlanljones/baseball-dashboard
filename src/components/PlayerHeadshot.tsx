/**
 * Circular player headshot from MLB's "spots" CDN, which serves a generic
 * silhouette for players without a photo. Decorative (empty alt) — the player
 * name is always adjacent text.
 *
 * Plain `<img>` rather than `next/image`: `images.unoptimized` is set, so the
 * component would add markup and client weight for no optimization. The tinted
 * wrapper holds the circle's space before the image lands, so a slate full of
 * probables never reflows.
 */
export default function PlayerHeadshot({
  personId,
  size = 24,
  className = "",
}: {
  personId: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 overflow-hidden rounded-full bg-ink/10 align-middle ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- images.unoptimized is set, so next/image would add weight without optimizing. */}
      <img
        src={`https://midfield.mlbstatic.com/v1/people/${personId}/spots/120`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </span>
  );
}
