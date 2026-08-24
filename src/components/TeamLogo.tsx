import Image from "next/image";

/**
 * MLB cap logo for a team. Renders both the on-light and on-dark variants and
 * lets CSS pick one, since several teams' primary marks are illegible on the
 * opposite background. Decorative (empty alt) — the team name is always
 * adjacent text.
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
  return (
    <span
      aria-hidden="true"
      className={`relative inline-block shrink-0 align-middle ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      <Image
        src={`https://www.mlbstatic.com/team-logos/team-cap-on-light/${teamId}.svg`}
        alt=""
        fill
        sizes={`${size}px`}
        className="object-contain dark:hidden"
      />
      <Image
        src={`https://www.mlbstatic.com/team-logos/team-cap-on-dark/${teamId}.svg`}
        alt=""
        fill
        sizes={`${size}px`}
        className="hidden object-contain dark:block"
      />
    </span>
  );
}
