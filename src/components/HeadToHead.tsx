import Link from "next/link";
import type { HeadToHead as HeadToHeadData } from "@/lib/mlb/types";

function name(t: { abbreviation?: string; name: string }): string {
  return t.abbreviation ?? t.name;
}

function seriesSummary(h2h: HeadToHeadData): string {
  const { teamA, teamB, aWins, bWins } = h2h;
  if (aWins === 0 && bWins === 0) return "No completed meetings yet this season.";
  if (aWins === bWins) return `Series tied ${aWins}–${bWins}.`;
  const leader = aWins > bWins ? teamA : teamB;
  const hi = Math.max(aWins, bWins);
  const lo = Math.min(aWins, bWins);
  return `${name(leader)} lead the season series ${hi}–${lo}.`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

export default function HeadToHead({ h2h }: { h2h: HeadToHeadData }) {
  const meetings = [...h2h.meetings].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
        {seriesSummary(h2h)}
      </p>

      {meetings.length > 0 && (
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {meetings.map((m) => {
            const isFinal = m.state === "Final";
            return (
              <li key={m.gamePk}>
                <Link
                  href={`/games/${m.gamePk}`}
                  className="flex items-center justify-between gap-3 py-1.5 text-sm hover:text-sky-600 dark:hover:text-sky-400"
                >
                  <span className="w-14 shrink-0 text-neutral-500">
                    {formatDate(m.date)}
                  </span>
                  <span className="flex-1 truncate">
                    {name(m.away.team)} @ {name(m.home.team)}
                  </span>
                  <span className="nums shrink-0 tabular-nums">
                    {isFinal
                      ? `${m.away.score ?? "-"}–${m.home.score ?? "-"}`
                      : m.state === "Live"
                        ? "Live"
                        : "—"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
