import GameLog from "./GameLog";
import type { GameFeed } from "@/lib/mlb/types";
import { getGamePlays } from "@/lib/mlb/game";

function SectionError({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay">
      Couldn't load {label} right now.
    </p>
  );
}

export default async function GameLogSection({ feed }: { feed: GameFeed }) {
  try {
    const plays = await getGamePlays(feed.gamePk);
    return <GameLog plays={plays} />;
  } catch (error) {
    console.error("Failed to fetch game plays:", error);
    return <SectionError label="game log" />;
  }
}
