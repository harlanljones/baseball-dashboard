/**
 * MLB cap logo for a team. Ships both the on-light and on-dark variants,
 * since several teams' primary marks are illegible on the opposite
 * background. Decorative (empty alt) — the team name is always adjacent text.
 *
 * `<picture>` rather than two elements with one hidden: a hidden image is
 * still fetched, so the old pair cost two requests per team — sixty on a
 * full slate — to show thirty marks. The media query mirrors the dark scheme
 * in globals.css, which is driven purely by `prefers-color-scheme`. The
 * `<picture>` itself holds the box (a table of logos renders one per row), so
 * no wrapper element is needed around it.
 *
 * A plain `<img>` rather than `next/image`: `images.unoptimized` is set, so the
 * component would add markup and client weight for no optimization.
 */
export default function TeamLogo({
  teamId,
  size = 20,
  className = "",
}: {
  teamId: number;
  size?: number;
  className?: string;
}) {
  const src = (variant: "light" | "dark") =>
    `https://www.mlbstatic.com/team-logos/team-cap-on-${variant}/${teamId}.svg`;

  return (
    <picture
      className={`inline-block shrink-0 align-middle ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <source media="(prefers-color-scheme: dark)" srcSet={src("dark")} />
      <img
        src={src("light")}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
      />
    </picture>
  );
}
