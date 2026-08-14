import { describe, it, expect } from "vitest";
import {
  clampPanePct,
  panePctFromPointer,
  parseStoredPanePct,
  MIN_PANE_PCT,
  MAX_PANE_PCT,
  DEFAULT_PANE_PCT,
} from "../paneWidth";

describe("clampPanePct", () => {
  it("passes values already in range through unchanged", () => {
    expect(clampPanePct(50)).toBe(50);
  });

  it("clamps below the minimum", () => {
    expect(clampPanePct(5)).toBe(MIN_PANE_PCT);
  });

  it("clamps above the maximum", () => {
    expect(clampPanePct(95)).toBe(MAX_PANE_PCT);
  });
});

describe("panePctFromPointer", () => {
  const rect = { left: 0, right: 1000, width: 1000 };

  it("computes the right-anchored width from the pointer position", () => {
    expect(panePctFromPointer(750, rect)).toBe(25);
    expect(panePctFromPointer(500, rect)).toBe(50);
    expect(panePctFromPointer(250, rect)).toBe(75);
  });

  it("clamps when the pointer is dragged past the shell edges", () => {
    expect(panePctFromPointer(-100, rect)).toBe(MAX_PANE_PCT);
    expect(panePctFromPointer(1100, rect)).toBe(MIN_PANE_PCT);
  });

  it("falls back to the default when the rect has no width", () => {
    expect(panePctFromPointer(400, { left: 0, right: 0, width: 0 })).toBe(
      DEFAULT_PANE_PCT,
    );
  });
});

describe("parseStoredPanePct", () => {
  it("returns null when nothing is stored", () => {
    expect(parseStoredPanePct(null)).toBeNull();
  });

  it("parses a valid in-range value", () => {
    expect(parseStoredPanePct("42")).toBe(42);
  });

  it("rejects non-numeric garbage", () => {
    expect(parseStoredPanePct("not-a-number")).toBeNull();
  });

  it("rejects out-of-range values rather than clamping them", () => {
    expect(parseStoredPanePct("5")).toBeNull();
    expect(parseStoredPanePct("95")).toBeNull();
  });
});
