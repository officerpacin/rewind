import { describe, expect, it } from "vitest";
import { validateAvatarUrl } from "./avatar";

function webpDataUrl(size = 16) {
  const image = Buffer.alloc(size);
  image.write("RIFF", 0, "ascii");
  image.write("WEBP", 8, "ascii");
  return `data:image/webp;base64,${image.toString("base64")}`;
}

describe("validateAvatarUrl", () => {
  it("accepts existing HTTP and HTTPS avatar URLs", () => {
    expect(validateAvatarUrl("https://images.example/avatar.jpg")).toEqual({
      ok: true,
      value: "https://images.example/avatar.jpg",
    });
    expect(validateAvatarUrl("http://images.example/avatar.png").ok).toBe(true);
  });

  it("accepts a compact, correctly labeled WebP data URL", () => {
    const avatar = webpDataUrl();
    expect(validateAvatarUrl(avatar)).toEqual({ ok: true, value: avatar });
  });

  it("rejects oversized, malformed, and unsupported inline image data", () => {
    expect(validateAvatarUrl(webpDataUrl(24_001)).ok).toBe(false);
    expect(validateAvatarUrl("data:image/png;base64,not-a-webp").ok).toBe(
      false,
    );
    expect(
      validateAvatarUrl(
        `data:image/webp;base64,${Buffer.from("not webp").toString("base64")}`,
      ).ok,
    ).toBe(false);
    expect(validateAvatarUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("allows removing an avatar", () => {
    expect(validateAvatarUrl(null)).toEqual({ ok: true, value: null });
  });
});
