import { describe, it, expect, vi, afterEach } from "vitest";
import { getOddsApiKey, oddsFetch, OddsApiError, resetOddsKeyPool } from "../client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetOddsKeyPool();
});

describe("getOddsApiKey", () => {
  it("returns null when ODDS_API_KEY is unset", () => {
    expect(getOddsApiKey()).toBeNull();
  });

  it("returns the key when set", () => {
    vi.stubEnv("ODDS_API_KEY", "abc123");
    expect(getOddsApiKey()).toBe("abc123");
  });
});

describe("oddsFetch", () => {
  it("throws OddsApiError without making a request when the key is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(oddsFetch("/v4/sports/baseball_mlb/events")).rejects.toThrow(
      OddsApiError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("appends the API key and params, and decodes JSON on success", async () => {
    vi.stubEnv("ODDS_API_KEY", "abc123");
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: "world" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await oddsFetch<{ hello: string }>("/v4/sports/baseball_mlb/events", {
      regions: "us",
    });

    expect(result).toEqual({ hello: "world" });
    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("apiKey")).toBe("abc123");
    expect(calledUrl.searchParams.get("regions")).toBe("us");
  });

  it("throws OddsApiError on a non-2xx response", async () => {
    vi.stubEnv("ODDS_API_KEY", "abc123");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );

    await expect(oddsFetch("/v4/sports/baseball_mlb/events")).rejects.toThrow(
      OddsApiError,
    );
  });

  it("redacts the API key from the thrown error's url and message on a non-2xx response", async () => {
    vi.stubEnv("ODDS_API_KEY", "super-secret-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({}) }),
    );

    try {
      await oddsFetch("/v4/sports/baseball_mlb/events", { regions: "us" });
      expect.unreachable("expected oddsFetch to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(OddsApiError);
      const apiErr = err as OddsApiError;
      expect(apiErr.url).not.toContain("super-secret-key");
      expect(apiErr.message).not.toContain("super-secret-key");
      expect(apiErr.url).toContain("regions=us");
    }
  });
});
