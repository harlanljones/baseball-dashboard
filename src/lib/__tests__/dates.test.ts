import { describe, expect, it } from "vitest";

import { daysBetween, isValidDate } from "../dates";

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

describe("isValidDate", () => {
  it("accepts real calendar dates", () => {
    expect(isValidDate("2026-09-28")).toBe(true);
    expect(isValidDate("2028-02-29")).toBe(true);
  });

  it("rejects dates that do not exist", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2027-02-29")).toBe(false);
    expect(isValidDate("2026-13-01")).toBe(false);
    expect(isValidDate("2026-00-10")).toBe(false);
    expect(isValidDate("2026-04-31")).toBe(false);
  });

  it("rejects malformed values", () => {
    expect(isValidDate("abc")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate("2026-9-28")).toBe(false);
    expect(isValidDate("2026-09-28T00:00:00Z")).toBe(false);
    expect(isValidDate(" 2026-09-28")).toBe(false);
  });
});
