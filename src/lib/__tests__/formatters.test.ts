import { describe, it, expect } from "vitest";

import { dateFormatter } from "../formatters";

describe("dateFormatter", () => {
  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  };

  it("reuses one instance for the same locale and options", () => {
    expect(dateFormatter("en-US", options)).toBe(dateFormatter("en-US", options));
  });

  it("keeps locales and option sets apart", () => {
    // Keying on the locale alone would silently format a date with another
    // call site's options.
    expect(dateFormatter("en-US", options)).not.toBe(dateFormatter("en-CA", options));
    expect(dateFormatter("en-US", options)).not.toBe(
      dateFormatter("en-US", { ...options, hour12: true }),
    );
  });

  it("formats exactly like an uncached formatter", () => {
    const iso = "2026-07-11T23:05:00Z";
    expect(dateFormatter("en-US", options).format(new Date(iso))).toBe(
      new Intl.DateTimeFormat("en-US", options).format(new Date(iso)),
    );
  });
});
