import { readFileSync } from "node:fs";
import {
  getPitcherPropStatsBatch, getSaberHittingBatch,
  getSaberPitchingWithSeasonStatsBatch, getPlatoonSplitBatch, getVsPlayerBatch,
  getPitcherRecentFormBatch, getRosterWithSeasonStats, getActiveRoster,
} from "@/lib/mlb/players";

const PEOPLE_FIELDS = "people,id,fullName,stats,splits,stat,season,type,displayName,group,batter,pitcher,plateAppearances,atBats,hits,homeRuns,rbi,baseOnBalls,totalBases,gamesPlayed,avg,obp,slg,babip,strikeOuts,inningsPitched,gamesStarted,battersFaced,earnedRuns,era,woba,wRcPlus,war,xwoba,fip,xfip,eraMinus,ops,date,numberOfPitches";
const ROSTER_FIELDS = "roster,person,id,fullName,position,type,role,name,stats,splits,stat,season,plateAppearances,atBats,hits,homeRuns,rbi,baseOnBalls,totalBases,gamesPlayed,avg,obp,slg,babip,strikeOuts";

function prune(value: unknown, wanted: Set<string>, listed = false): unknown {
  if (Array.isArray(value)) {
    const items = value.map((v) => prune(v, wanted, listed)).filter((v) => v !== undefined);
    return listed || items.length ? items : undefined;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, c] of Object.entries(value as object)) {
      const keep = wanted.has(k);
      if (!keep && !hasListed(c, wanted)) continue;
      const p = prune(c, wanted, keep);
      if (p !== undefined) out[k] = p;
    }
    return listed || Object.keys(out).length ? out : undefined;
  }
  return listed ? value : undefined;
}
function hasListed(value: unknown, wanted: Set<string>): boolean {
  if (Array.isArray(value)) return value.some((v) => hasListed(v, wanted));
  if (value && typeof value === "object") return Object.entries(value as object).some(([k, v]) => wanted.has(k) || hasListed(v, wanted));
  return false;
}

let body = "";
globalThis.fetch = (async () => new Response(body, { status: 200, headers: { "content-type": "application/json" } })) as typeof globalThis.fetch;

const batters = [{ id: 592450, fullName: "Aaron Judge" }, { id: 660271, fullName: "Shohei Ohtani" }, { id: 605141, fullName: "Mookie Betts" }];
const pitchers = [{ id: 605400, fullName: "Aaron Nola" }, { id: 678061, fullName: "Ray Kerr" }];

const cases: [string, string, Set<string>, () => Promise<unknown>][] = [
  ["pitching", "pitching", new Set(PEOPLE_FIELDS.split(",")), () => getPitcherPropStatsBatch(pitchers.map((p) => p.id), 2026)],
  ["saberhit", "saberhit", new Set(PEOPLE_FIELDS.split(",")), () => getSaberHittingBatch(batters.map((b) => b.id), 2026)],
  ["saberpit", "saberpit", new Set(PEOPLE_FIELDS.split(",")), () => getSaberPitchingWithSeasonStatsBatch(pitchers.map((p) => p.id), 2026)],
  ["splits", "splits", new Set(PEOPLE_FIELDS.split(",")), () => getPlatoonSplitBatch(batters, "R", 2026)],
  ["vsplayer", "vsplayer", new Set(PEOPLE_FIELDS.split(",")), () => getVsPlayerBatch(batters, pitchers[0])],
  ["gamelog", "gamelog", new Set(PEOPLE_FIELDS.split(",")), () => getPitcherRecentFormBatch(pitchers.map((p) => p.id), "2026-10-11")],
  ["roster", "roster", new Set(ROSTER_FIELDS.split(",")), () => getRosterWithSeasonStats(147, 2026)],
  ["active", "active", new Set(ROSTER_FIELDS.split(",")), () => getActiveRoster(147)],
];

for (const [name, file, fields, run] of cases) {
  const full = readFileSync(`/tmp/v-${file}-full.json`, "utf8");
  const apiNarrow = readFileSync(`/tmp/v-${file}-narrow.json`, "utf8");
  const localPrune = JSON.stringify(prune(JSON.parse(full), fields));
  // Maps do not survive JSON.stringify; serialize them as entries so the
  // comparison is on real content rather than on "{}".
  const dump = async () => JSON.stringify(await run(), (_k, v) => (v instanceof Map ? [...v.entries()] : v));
  body = full; const a = await dump();
  body = localPrune; const b = await dump();
  body = apiNarrow; const c = await dump();
  const ok = a === b && a === c;
  console.log(`${name.padEnd(9)} shaped ${String(a.length).padStart(6)} bytes | local-prune identical: ${a === b} | API-narrowed identical: ${a === c} | pruned ${(localPrune.length / 1024).toFixed(0)}KB / api ${(apiNarrow.length / 1024).toFixed(0)}KB`);
  if (!ok) {
    const x = a === b ? a : b;
    for (let i = 0; i < Math.max(a.length, x.length); i++) {
      if (a[i] !== x[i]) { console.log("   first diff:", a.slice(Math.max(0, i - 70), i + 70), "VS", x.slice(Math.max(0, i - 70), i + 70)); break; }
    }
  }
}
