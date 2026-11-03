import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRIMARY_API,
  DEFAULT_CATALOG_API,
  isSecureBaseUrl,
  resolveMusicOnlyMode,
  resolveApiBaseUrl,
  resolveCatalogApiBaseUrl,
} from "./baseUrl";

describe("api base url", () => {
  it("enables music-only mode only when explicitly set to true", () => {
    expect(resolveMusicOnlyMode("true")).toBe(true);
    expect(resolveMusicOnlyMode(undefined)).toBe(false);
    expect(resolveMusicOnlyMode("false")).toBe(false);
  });

  it("uses the primary api when no override is set", () => {
    expect(resolveApiBaseUrl(undefined)).toBe(DEFAULT_PRIMARY_API);
    expect(resolveApiBaseUrl("  ")).toBe(DEFAULT_PRIMARY_API);
  });

  it("uses an explicitly provided same-host fallback", () => {
    expect(resolveApiBaseUrl(undefined, "https://music.example.com")).toBe(
      "https://music.example.com",
    );
    expect(
      resolveApiBaseUrl(
        "http://insecure.example.com",
        "https://music.example.com",
      ),
    ).toBe("https://music.example.com");
  });

  it("uses the Liner catalog API unless explicitly configured", () => {
    expect(resolveCatalogApiBaseUrl(undefined)).toBe(DEFAULT_CATALOG_API);
    expect(resolveCatalogApiBaseUrl("https://catalog.example.com/")).toBe(
      "https://catalog.example.com",
    );
    expect(resolveCatalogApiBaseUrl("http://insecure.example.com")).toBe(
      DEFAULT_CATALOG_API,
    );
  });

  it("accepts an https override and trims trailing slashes", () => {
    expect(resolveApiBaseUrl("https://staging.example.com/")).toBe(
      "https://staging.example.com",
    );
  });

  it("accepts plain http only to loopback", () => {
    for (const url of [
      "http://localhost:1337",
      "http://127.0.0.1:1337",
      "http://[::1]:1337",
    ]) {
      expect(isSecureBaseUrl(url)).toBe(true);
      expect(resolveApiBaseUrl(url)).toBe(url);
    }
  });

  it("refuses plain http to a remote host and malformed urls", () => {
    expect(resolveApiBaseUrl("http://edge.tryliner.fun:10518")).toBe(
      DEFAULT_PRIMARY_API,
    );
    expect(resolveApiBaseUrl("not a url")).toBe(DEFAULT_PRIMARY_API);
  });
});
