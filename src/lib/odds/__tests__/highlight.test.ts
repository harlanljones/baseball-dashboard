import { describe, it, expect } from "vitest";
import { scoreProp, type StatContext } from "../highlight";
import type { PlayerProp } from "../types";
import type { PlayerRef } from "@/lib/mlb/types";
import type { GameWeather } from "@/lib/weather/types";

const player: PlayerRef = { id: 1, fullName: "Test Player" };

function prop(overrides: Partial<PlayerProp>): PlayerProp {
  return {
    marketKey: "pitcher_strikeouts",
    playerName: "Test Player",
    line: 6,
    overPrice: -110,
    underPrice: -110,
    ...overrides,
  };
}

function windWeather(category: "out" | "in" | "calm", tempF: number): GameWeather {
  return {
    ballpark: null,
    elevationFt: null,
    roof: null,
    hours: [],
    tempRangeF: null,
    humidityPct: null,
    observed: null,
    gametime: {
      timeISO: "2026-07-22T23:00:00Z",
      tempF,
      humidityPct: 50,
      sky: "clear",
      skyLabel: "Clear",
      cloudCoverPct: 0,
      precipProbabilityPct: 0,
      wind: { plateRelativeDeg: 0, category, label: "", speedMph: 10 },
    },
  };
}

describe("scoreProp — pitcher strikeouts", () => {
  const pitcherStats: StatContext = {
    kind: "pitcher",
    k9: 12,
    outsPerStart: 18, // 6 IP/start -> expected K = (12/9)*6 = 8
    gamesStarted: 20,
  };

  it("tiers strong-over when season rate is far above the line", () => {
    const result = scoreProp(prop({ line: 6 }), player, pitcherStats, null);
    expect(result.tier).toBe("strong-over"); // 8 / 6 = 1.33
  });

  it("tiers lean-over just above the line", () => {
    const stats: StatContext = { ...pitcherStats, k9: 10.5 }; // expected K = 7
    const result = scoreProp(prop({ line: 6.2 }), player, stats, null);
    expect(result.tier).toBe("lean-over"); // 7 / 6.2 = 1.13
  });

  it("tiers neutral when close to the line", () => {
    const stats: StatContext = { ...pitcherStats, k9: 10.5 }; // expected K = 7
    const result = scoreProp(prop({ line: 6.8 }), player, stats, null);
    expect(result.tier).toBe("neutral"); // 7 / 6.8 = 1.03
  });

  it("tiers lean-under and strong-under symmetrically", () => {
    const leanStats: StatContext = { ...pitcherStats, k9: 7.5 }; // expected K = 5
    expect(scoreProp(prop({ line: 6 }), player, leanStats, null).tier).toBe(
      "lean-under",
    ); // 5 / 6 = 0.83

    const strongStats: StatContext = { ...pitcherStats, k9: 6 }; // expected K = 4
    expect(scoreProp(prop({ line: 6 }), player, strongStats, null).tier).toBe(
      "strong-under",
    ); // 4 / 6 = 0.67
  });

  it("stays neutral for a small sample regardless of the raw rate", () => {
    const stats: StatContext = { ...pitcherStats, gamesStarted: 2 };
    const result = scoreProp(prop({ line: 6 }), player, stats, null);
    expect(result.tier).toBe("neutral");
  });
});

describe("scoreProp — pitcher outs", () => {
  it("scores directly off outsPerStart", () => {
    const stats: StatContext = {
      kind: "pitcher",
      k9: 9,
      outsPerStart: 18,
      gamesStarted: 20,
    };
    const result = scoreProp(
      prop({ marketKey: "pitcher_outs", line: 15 }),
      player,
      stats,
      null,
    );
    expect(result.tier).toBe("lean-over"); // 18 / 15 = 1.2
  });
});

describe("scoreProp — batter markets", () => {
  const batterStats: StatContext = {
    kind: "batter",
    hitsPerGame: 1.0,
    totalBasesPerGame: 1.6,
    hrPerGame: 0.345,
    rbiPerGame: 0.6,
    bbPerGame: 0.4,
    games: 100,
  };

  it("scores batter_hits off hitsPerGame", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }),
      player,
      batterStats,
      null,
    );
    expect(result.tier).toBe("lean-over"); // 1.0 / 0.8 = 1.25
  });

  it("stays neutral for a small sample regardless of the raw rate", () => {
    const stats: StatContext = { ...batterStats, games: 10 };
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.5 }),
      player,
      stats,
      null,
    );
    expect(result.tier).toBe("neutral");
  });

  it("returns neutral with a 'no stats' label when stats are unavailable", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }),
      player,
      null,
      null,
    );
    expect(result.tier).toBe("neutral");
    expect(result.statLabel).toBe("No stats available");
  });
});

describe("scoreProp — weather nudge", () => {
  const hrStats: StatContext = {
    kind: "batter",
    hitsPerGame: 1.0,
    totalBasesPerGame: 1.6,
    hrPerGame: 0.345, // vs line 0.3 -> ratio 1.15 -> lean-over baseline
    rbiPerGame: 0.6,
    bbPerGame: 0.4,
    games: 100,
  };

  it("nudges batter_home_runs from lean-over to strong-over when wind blows out", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("out", 70),
    );
    expect(result.tier).toBe("strong-over");
  });

  it("nudges batter_home_runs from lean-over to neutral when wind blows in", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("in", 70),
    );
    expect(result.tier).toBe("neutral");
  });

  it("does not nudge past strong-over", () => {
    const stats: StatContext = { ...hrStats, hrPerGame: 1.0 }; // ratio 3.3 -> strong-over baseline
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      stats,
      windWeather("out", 70),
    );
    expect(result.tier).toBe("strong-over");
  });

  it("does not nudge a non weather-sensitive market (batter_hits)", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }), // hitsPerGame 1.0 / 0.8 = 1.25 -> lean-over
      player,
      hrStats,
      windWeather("out", 70),
    );
    expect(result.tier).toBe("lean-over");
  });

  it("does not nudge when weather has no gametime hour", () => {
    const weather: GameWeather = {
      ballpark: null,
      elevationFt: null,
      roof: null,
      hours: [],
      tempRangeF: null,
      humidityPct: null,
      observed: null,
      gametime: null,
    };
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      weather,
    );
    expect(result.tier).toBe("lean-over");
  });
});
