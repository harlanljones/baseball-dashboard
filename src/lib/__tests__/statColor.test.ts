import { describe, expect, it } from "vitest";

import { BAD_CLASS, GOOD_CLASS, quantileBand, quantileClass } from "../statColor";

describe("quantile stat coloring", () => {
  const band = quantileBand([1, 2, 3, 4, 5]);

  it("colors higher-is-better metrics by the outer quartiles", () => {
    expect(quantileClass(1, band, true)).toBe(BAD_CLASS);
    expect(quantileClass(3, band, true)).toBe("");
    expect(quantileClass(5, band, true)).toBe(GOOD_CLASS);
  });

  it("reverses the colors for lower-is-better metrics", () => {
    expect(quantileClass(1, band, false)).toBe(GOOD_CLASS);
    expect(quantileClass(3, band, false)).toBe("");
    expect(quantileClass(5, band, false)).toBe(BAD_CLASS);
  });

  it("stays neutral without enough distinct comparison data", () => {
    expect(quantileBand([1, 2, 3])).toBeNull();
    expect(quantileBand([2, 2, 2, 2])).toBeNull();
    expect(quantileClass(2, null, true)).toBe("");
  });
});
