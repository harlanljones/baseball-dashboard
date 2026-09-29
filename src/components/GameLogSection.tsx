import GameLog from "./GameLog";
import SectionError from "./SectionError";
import type { GameFeed } from "@/lib/mlb/types";
import { getGamePlays } from "@/lib/mlb/game";

export default async function GameLogSection({ feed }: { feed: GameFeed }) {
  // Await inside try/catch, build JSX outside — a try/catch cannot catch errors
  // thrown while React later renders returned JSX.
  let plays;
  try {
    plays = await getGamePlays(feed.gamePk);
  } catch (error) {
    console.error("Failed to fetch game plays:", error);
    return <SectionError label="the game log" />;
  }

  return <GameLog plays={plays} />;
}
