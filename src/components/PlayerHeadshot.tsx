import Image from "next/image";

/**
 * Circular player headshot from MLB's "spots" CDN, which serves a generic
 * silhouette for players without a photo. Decorative (empty alt) — the player
 * name is always adjacent text.
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
      className={`relative inline-block shrink-0 overflow-hidden rounded-full bg-ink/10 align-middle ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <Image
        src={`https://midfield.mlbstatic.com/v1/people/${personId}/spots/120`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-cover"
      />
    </span>
  );
}
