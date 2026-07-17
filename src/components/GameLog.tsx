import type { ScoringPlay } from "@/lib/mlb/types";

function gameLogKey(inning: number, ordinal: string): string {
  return `${inning}-${ordinal}`;
}

export default function GameLog({ plays }: { plays: ScoringPlay[] }) {
  // Group plays by inning and ordinal
  const grouped = new Map<string, ScoringPlay[]>();
  for (const play of plays) {
    const key = gameLogKey(play.inning, play.ordinal);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(play);
  }

  // Render inning cards in order
  const inningKeys = Array.from(grouped.keys()).sort((a, b) => {
    const [aInning, aOrdinal] = a.split("-");
    const [bInning] = b.split("-");
    const ainningNum = parseInt(aInning, 10);
    const binningNum = parseInt(bInning, 10);
    if (ainningNum !== binningNum) return ainningNum - binningNum;
    // Top before Bottom
    return aOrdinal === "Top" ? -1 : 1;
  });

  return (
    <div className="space-y-3">
      {inningKeys.length === 0 && (
        <p className="text-sm text-ink/60">No scoring plays yet.</p>
      )}
      {inningKeys.map((key) => {
        const inningPlays = grouped.get(key)!;
        const [inning, ordinal] = key.split("-");
        return (
          <div
            key={key}
            className="rounded-md border border-ink/10 bg-card p-3 shadow-sm"
          >
            <h3 className="font-display mb-2 text-sm font-semibold text-ink/80">
              {ordinal} {inning}
            </h3>
            <ul className="space-y-1">
              {inningPlays.map((play, idx) => (
                <li key={idx} className="text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex-1 text-ink/80">
                      • {play.description}
                    </span>
                    <span className="whitespace-nowrap font-mono text-xs text-ink/60">
                      {play.awayScore}-{play.homeScore}{" "}
                      {play.awayScore > play.homeScore
                        ? "Away"
                        : play.homeScore > play.awayScore
                          ? "Home"
                          : "Tied"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
