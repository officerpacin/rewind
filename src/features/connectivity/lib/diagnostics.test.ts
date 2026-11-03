import { describe, expect, it } from "vitest";
import { DEFAULT_CATALOG_API } from "@/shared/api/baseUrl";
import { DIAG_ENDPOINTS } from "./diagnostics";

describe("connectivity diagnostic endpoints", () => {
  it("checks the music API rather than the unconfigured account API", () => {
    expect(DIAG_ENDPOINTS.api).toBe(DEFAULT_CATALOG_API);
    expect(DIAG_ENDPOINTS.api).not.toBe("http://localhost:1337");
  });
});
