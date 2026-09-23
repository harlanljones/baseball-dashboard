import { describe, expect, it } from "vitest";

import { daysBetween } from "../dates";

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-09-23", "2027-03-25")).toBe(183);
  });

  it("is zero for the same date", () => {
    expect(daysBetween("2027-03-25", "2027-03-25")).toBe(0);
  });

  it("is negative when the target date has passed", () => {
    expect(daysBetween("2027-03-25", "2026-09-23")).toBe(-183);
  });

  it("crosses a leap-year February correctly", () => {
    expect(daysBetween("2028-02-01", "2028-03-01")).toBe(29);
  });
});
