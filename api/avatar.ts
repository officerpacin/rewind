const MAX_AVATAR_URL_LENGTH = 2_048;
const MAX_AVATAR_DATA_URL_LENGTH = 32_000;
const MAX_AVATAR_IMAGE_BYTES = 24_000;
const WEBP_DATA_URL = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/;

export type AvatarUrlValidation =
  { ok: true; value: string | null } | { ok: false };

export function validateAvatarUrl(value: unknown): AvatarUrlValidation {
  if (value === null) return { ok: true, value: null };
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > MAX_AVATAR_DATA_URL_LENGTH
  ) {
    return { ok: false };
  }

  const avatar = value.trim();
  if (avatar.length <= MAX_AVATAR_URL_LENGTH) {
    try {
      const url = new URL(avatar);
      if (url.protocol === "https:" || url.protocol === "http:") {
        return { ok: true, value: avatar };
      }
    } catch {
      // Check whether this is one of the compact inline avatars supported below.
    }
  }

  const match = WEBP_DATA_URL.exec(avatar);
  if (!match) return { ok: false };

  const image = Buffer.from(match[1], "base64");
  if (
    image.length === 0 ||
    image.length > MAX_AVATAR_IMAGE_BYTES ||
    image.toString("base64") !== match[1] ||
    image.toString("ascii", 0, 4) !== "RIFF" ||
    image.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return { ok: false };
  }

  return { ok: true, value: avatar };
}
