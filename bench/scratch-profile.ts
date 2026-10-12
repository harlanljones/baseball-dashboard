import { renderToStaticMarkup } from "react-dom/server";
import { createElement, Fragment } from "react";
import { BENCH_SEASON, GAMES, PROPS_GAME } from "./fixture";
import { installUpstream } from "./upstream";
import { feedFor } from "./workload";
import { loadPropGroups } from "@/components/PropsSidebarSection";
import { propContextFromFeed } from "@/lib/odds/board";
import { getSgoPlayerProps } from "@/lib/odds/sgo";
import { getBestLeans } from "@/lib/odds/leans";
import { getSchedule } from "@/lib/mlb/schedule";
import { getRosterWithSeasonStats, getPitcherPropStatsBatch } from "@/lib/mlb/players";
import { buildMatchups } from "@/lib/mlb/matchup";
import PlayerPropsBoard from "@/components/PlayerPropsBoard";
import GameCard from "@/components/GameCard";
import { withOddsScope } from "@/lib/odds/requestScope";

installUpstream();
process.env.SPORTSGAMEODDS_API_KEY = "k";
const feed = feedFor(PROPS_GAME);
const game = propContextFromFeed(feed);

const time = async (label: string, runs: number, fn: () => Promise<unknown> | unknown) => {
  await fn();
  const t = performance.now();
  for (let i = 0; i < runs; i++) await fn();
  console.log(label.padEnd(38), ((performance.now() - t) / runs).toFixed(3), "ms");
};

await time("schedule", 30, () => getSchedule("2026-07-11"));
await time("board read+parse (1 event out)", 30, () => withOddsScope(() => getSgoPlayerProps(`SGO_${PROPS_GAME.gamePk}`)));
await time("2 rosters + pitcher batch", 30, () => Promise.all([getRosterWithSeasonStats(game.away.id, BENCH_SEASON), getRosterWithSeasonStats(game.home.id, BENCH_SEASON), getPitcherPropStatsBatch([1, 2], BENCH_SEASON)]));
await time("loadPropGroups no-feed", 30, () => loadPropGroups({ game, season: BENCH_SEASON, weather: null }));
await time("loadPropGroups with feed", 30, () => loadPropGroups({ game, season: BENCH_SEASON, weather: null, feed }));
await time("buildMatchups", 30, () => buildMatchups(feed, BENCH_SEASON));
await time("getBestLeans (8 games)", 20, () => getBestLeans("2026-07-11"));
const groups = await loadPropGroups({ game, season: BENCH_SEASON, weather: null, feed });
const day = await getSchedule("2026-07-11");
await time("render board", 30, () => renderToStaticMarkup(createElement(PlayerPropsBoard, { groups, gameHref: "/games/1" })));
await time("render 15 GameCards", 30, () => renderToStaticMarkup(createElement(Fragment, null, ...day.games.map((g) => createElement(GameCard, { key: g.gamePk, game: g })))));
console.log("props on board:", groups.flatMap((g) => g.players.flatMap((p) => p.props)).length, "games", GAMES.length);
