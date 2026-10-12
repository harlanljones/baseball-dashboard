import { describe, it, expect } from "vitest";
import { indexByNormalizedName, normalizePlayerName } from "../playerMatch";
import type { PlayerRef } from "@/lib/mlb/types";

describe("normalizePlayerName", () => {
  it("strips accents", () => {
    expect(normalizePlayerName("Ronald Acuña Jr.")).toBe("ronald acuna");
  });

  it("strips periods from initials without splitting them", () => {
    expect(normalizePlayerName("J.D. Martinez")).toBe("jd martinez");
    expect(normalizePlayerName("JD Martinez")).toBe("jd martinez");
  });

  it("strips Jr./Sr./numeral suffixes", () => {
    expect(normalizePlayerName("Ronald Acuna Jr.")).toBe("ronald acuna");
    expect(normalizePlayerName("Fernando Tatis Jr")).toBe("fernando tatis");
    expect(normalizePlayerName("Vladimir Guerrero Jr.")).toBe(
      "vladimir guerrero",
    );
  });

  it("treats hyphenated names as space-separated", () => {
    expect(normalizePlayerName("Jean-Segura")).toBe("jean segura");
  });

  it("is case-insensitive and collapses whitespace", () => {
    expect(normalizePlayerName("  Aaron   JUDGE ")).toBe("aaron judge");
  });
});

describe("indexByNormalizedName", () => {
  const roster: PlayerRef[] = [
    { id: 1, fullName: "Ronald Acuna Jr." },
    { id: 2, fullName: "JD Martinez" },
    { id: 3, fullName: "Aaron Judge" },
  ];
  const byName = indexByNormalizedName(roster, (player) => player.fullName);

  it("matches an exact normalized name", () => {
    expect(byName.get(normalizePlayerName("Aaron Judge"))).toEqual(roster[2]);
  });

  it("matches across accent and suffix differences", () => {
    expect(byName.get(normalizePlayerName("Ronald Acuña Jr."))).toEqual(roster[0]);
  });

  it("matches across initial-punctuation differences", () => {
    expect(byName.get(normalizePlayerName("J.D. Martinez"))).toEqual(roster[1]);
  });

  it("leaves a name that no roster entry normalizes to unattributed", () => {
    expect(byName.get(normalizePlayerName("Mike Trout"))).toBeUndefined();
  });

  it("keeps the first entry when two roster entries normalize to one name", () => {
    const duplicated: PlayerRef[] = [
      { id: 7, fullName: "J.D. Martinez" },
      { id: 8, fullName: "JD Martinez" },
    ];
    const index = indexByNormalizedName(duplicated, (player) => player.fullName);
    expect(index.get("jd martinez")).toEqual(duplicated[0]);
  });

  it("keys on whichever field holds the name", () => {
    const entries = [{ player: roster[2], team: { id: 147, name: "New York Yankees" } }];
    const index = indexByNormalizedName(entries, (entry) => entry.player.fullName);
    expect(index.get("aaron judge")).toEqual(entries[0]);
  });
});
