import { describe, it, expect } from "vitest";
import { matchupEvidence, scoreProp, type MatchupContext, type StatContext } from "../highlight";
import type { PlayerProp } from "../types";
import type { PitcherRecentForm, PitcherSplitLine, PlayerRef, SplitLine, VsPlayerLine } from "@/lib/mlb/types";
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

function windWeather(
  category: "out" | "in" | "calm",
  tempF: number,
  roof: GameWeather["roof"] = "open",
): GameWeather {
  return {
    ballpark: null,
    elevationFt: null,
    roof,
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
    expect(result.evidence).toEqual(["No stats available"]);
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

  it("does not nudge under a dome even when wind would otherwise blow out", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("out", 70, "dome"),
    );
    expect(result.tier).toBe("lean-over"); // unmodified baseline, no nudge
  });

  it("does not nudge under a retractable-closed roof even when wind would otherwise blow out", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("out", 70, "retractable"),
    );
    expect(result.tier).toBe("lean-over"); // unmodified baseline, no nudge
  });

  it("does not nudge when roof state is unknown (null)", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("out", 70, null),
    );
    expect(result.tier).toBe("lean-over"); // unmodified baseline, no nudge
  });

  it("nudges from lean-over to strong-over on a hot day (>=85F) at an open-air park", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("calm", 90, "open"),
    );
    expect(result.tier).toBe("strong-over");
  });

  it("nudges from lean-over to neutral on a cold day (<=45F) at an open-air park", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("calm", 40, "open"),
    );
    expect(result.tier).toBe("neutral");
  });

  it("does not nudge for a hot day under a dome", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("calm", 95, "dome"),
    );
    expect(result.tier).toBe("lean-over"); // unmodified baseline, no nudge
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

describe("scoreProp — evidence", () => {
  const batterStats: StatContext = {
    kind: "batter",
    hitsPerGame: 1.0,
    totalBasesPerGame: 1.6,
    hrPerGame: 0.345,
    rbiPerGame: 0.6,
    bbPerGame: 0.4,
    games: 100,
  };

  it("always leads with the season avg line", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }),
      player,
      batterStats,
      null,
    );
    expect(result.evidence[0]).toBe("Season avg: 1.0 (line 0.8)");
  });

  it("adds a weather line only when the nudge actually changes the tier", () => {
    const hrStats: StatContext = { ...batterStats, hrPerGame: 0.345 }; // vs line 0.3 -> lean-over baseline
    const result = scoreProp(
      prop({ marketKey: "batter_home_runs", line: 0.3 }),
      player,
      hrStats,
      windWeather("out", 70),
    );
    expect(result.tier).toBe("strong-over");
    expect(result.evidence).toContain("Wind blowing out favors the over");
  });

  it("does not add a weather line for a non weather-sensitive market", () => {
    const result = scoreProp(
      prop({ marketKey: "batter_hits", line: 0.8 }),
      player,
      batterStats,
      windWeather("out", 70),
    );
    expect(result.evidence.some((l) => l.startsWith("Wind blowing"))).toBe(false);
  });
});

describe("matchupEvidence — batter", () => {
  const pitcher: PlayerRef = { id: 2, fullName: "Gerrit Cole" };

  function vsPitcher(overrides: Partial<VsPlayerLine>): VsPlayerLine {
    return {
      batter: player,
      pitcher,
      hasHistory: true,
      pa: 10,
      h: 4,
      hr: 1,
      bb: 1,
      k: 2,
      avg: ".400",
      obp: ".500",
      slg: ".700",
      ...overrides,
    };
  }

  function platoon(overrides: Partial<SplitLine>): SplitLine {
    return { pa: 20, obp: ".380", ops: ".820", bbPct: "9.0%", kPct: "18.0%", ...overrides };
  }

  it("returns an empty list for a null matchup", () => {
    expect(matchupEvidence(null)).toEqual([]);
  });

  it("adds head-to-head history when the sample is big enough", () => {
    const matchup: MatchupContext = { kind: "batter", vsPitcher: vsPitcher({ pa: 10 }) };
    expect(matchupEvidence(matchup)).toContain("Career vs Gerrit Cole: 4 H in 10 PA, 1 HR");
  });

  it("omits head-to-head history when the sample is too thin", () => {
    const matchup: MatchupContext = { kind: "batter", vsPitcher: vsPitcher({ pa: 2, hasHistory: true }) };
    expect(matchupEvidence(matchup).some((l) => l.startsWith("Career vs"))).toBe(false);
  });

  it("omits head-to-head history when the pair has never faced each other", () => {
    const matchup: MatchupContext = {
      kind: "batter",
      vsPitcher: vsPitcher({ pa: 0, hasHistory: false }),
    };
    expect(matchupEvidence(matchup).some((l) => l.startsWith("Career vs"))).toBe(false);
  });

  it("adds the platoon split when the sample is big enough", () => {
    const matchup: MatchupContext = {
      kind: "batter",
      platoon: platoon({ pa: 20 }),
      vsHand: "R",
    };
    expect(matchupEvidence(matchup)).toContain("vs RHP this year: .820 OPS (20 PA)");
  });

  it("omits the platoon split when the sample is too thin", () => {
    const matchup: MatchupContext = {
      kind: "batter",
      platoon: platoon({ pa: 5 }),
      vsHand: "R",
    };
    expect(matchupEvidence(matchup).some((l) => l.startsWith("vs RHP"))).toBe(false);
  });

  it("can return both lines at once", () => {
    const matchup: MatchupContext = {
      kind: "batter",
      vsPitcher: vsPitcher({ pa: 10 }),
      platoon: platoon({ pa: 20 }),
      vsHand: "R",
    };
    expect(matchupEvidence(matchup)).toEqual([
      "Career vs Gerrit Cole: 4 H in 10 PA, 1 HR",
      "vs RHP this year: .820 OPS (20 PA)",
    ]);
  });
});

describe("matchupEvidence — pitcher", () => {
  it("adds recent form and home/road split", () => {
    const recentForm: PitcherRecentForm = { ip: "24.0", era: "2.50", bbPct: "6.0%", kPct: "32.0%", starts: 4 };
    const homeAway: PitcherSplitLine = { ip: "80.0", era: "3.10", bbPct: "7.0%", kPct: "28.0%" };
    const matchup: MatchupContext = { kind: "pitcher", recentForm, homeAway, isHome: true };
    const result = matchupEvidence(matchup);
    expect(result).toContain("Last 30 days: 2.50 ERA, 32.0% K rate over 4 starts");
    expect(result).toContain("Home starts this year: 3.10 ERA, 80.0 IP");
  });

  it("omits recent form when the pitcher hasn't started in the window", () => {
    const recentForm: PitcherRecentForm = { ip: "0.0", bbPct: "-", kPct: "-", starts: 0 };
    const matchup: MatchupContext = { kind: "pitcher", recentForm, isHome: true };
    expect(matchupEvidence(matchup).some((l) => l.startsWith("Last 30 days"))).toBe(false);
  });

  it("omits the home/road split when the pitcher hasn't pitched in it", () => {
    const homeAway: PitcherSplitLine = { ip: "0.0", bbPct: "-", kPct: "-" };
    const matchup: MatchupContext = { kind: "pitcher", homeAway, isHome: true };
    expect(matchupEvidence(matchup).some((l) => l.startsWith("Home starts"))).toBe(false);
  });
});
