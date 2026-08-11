import { describe, it, expect } from "vitest";
import { normalizePlayerName, matchPlayerName } from "../playerMatch";
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

describe("matchPlayerName", () => {
  const roster: PlayerRef[] = [
    { id: 1, fullName: "Ronald Acuna Jr." },
    { id: 2, fullName: "JD Martinez" },
    { id: 3, fullName: "Aaron Judge" },
  ];

  it("matches an exact normalized name", () => {
    expect(matchPlayerName("Aaron Judge", roster)).toEqual(roster[2]);
  });

  it("matches across accent and suffix differences", () => {
    expect(matchPlayerName("Ronald Acuña Jr.", roster)).toEqual(roster[0]);
  });

  it("matches across initial-punctuation differences", () => {
    expect(matchPlayerName("J.D. Martinez", roster)).toEqual(roster[1]);
  });

  it("returns null when no roster entry matches", () => {
    expect(matchPlayerName("Mike Trout", roster)).toBeNull();
  });
});
