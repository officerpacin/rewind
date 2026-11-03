import { neon } from "@neondatabase/serverless";
import { compare, hash } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, randomUUID } from "node:crypto";

type UserRow = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_public: boolean;
  show_activity: boolean;
  show_history: boolean;
  show_liked_tracks: boolean;
  participate_leaderboards: boolean;
  created_at: string;
};

type Query = (
  query: string,
  params?: (string | number | boolean | null | Date)[],
) => Promise<Record<string, unknown>[]>;

const ACCESS_TOKEN_SECONDS = 15 * 60;
const MAX_BODY_BYTES = 1_000_000;
let sql: ReturnType<typeof neon> | undefined;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function database(): Query {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new HttpError(
      503,
      "DATABASE_NOT_CONFIGURED",
      "Database is not configured.",
    );
  sql ??= neon(url);
  return (query, params = []) =>
    sql!.query(query, params) as Promise<Record<string, unknown>[]>;
}

function jwtKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new HttpError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Authentication is not configured.",
    );
  }
  return new TextEncoder().encode(secret);
}

function json(
  data: unknown,
  status = 200,
  headers: HeadersInit = {},
): Response {
  return new Response(data === undefined ? null : JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers":
        "authorization, content-type, if-none-match, x-request-id, x-client-version, x-platform, x-session-id, x-user-id, x-user-name, x-liner-signature, x-liner-timestamp, x-liner-nonce",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function fail(status: number, code: string, message: string): never {
  throw new HttpError(status, code, message);
}

function userView(row: UserRow, includeEmail = false) {
  return {
    id: row.id,
    ...(includeEmail ? { email: row.email } : {}),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isPublic: row.is_public,
    showActivity: row.show_activity,
    showHistory: row.show_history,
    showLikedTracks: row.show_liked_tracks,
    participateLeaderboards: row.participate_leaderboards,
  };
}

function profileView(
  row: UserRow,
  followersCount: number,
  followingCount: number,
  isFollowing?: boolean,
) {
  return {
    ...userView(row),
    followersCount,
    followingCount,
    createdAt: row.created_at,
    ...(isFollowing === undefined ? {} : { isFollowing }),
    privacy: {
      isPublic: row.is_public,
      showActivity: row.show_activity,
      showHistory: row.show_history,
      showLikedTracks: row.show_liked_tracks,
      participateLeaderboards: row.participate_leaderboards,
    },
  };
}

async function issueTokens(user: UserRow) {
  const accessTokenExpiresAt = new Date(
    Date.now() + ACCESS_TOKEN_SECONDS * 1000,
  );
  const accessToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(accessTokenExpiresAt.getTime() / 1000))
    .sign(jwtKey());
  const refreshToken = randomBytes(32).toString("base64url");
  await database()(
    "INSERT INTO refresh_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '30 days')",
    [tokenHash(refreshToken), user.id],
  );
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    expiresAt: accessTokenExpiresAt.getTime(),
    user: userView(user, true),
  };
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function authenticatedUser(request: Request): Promise<string> {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) fail(401, "UNAUTHORIZED", "Sign in to continue.");
  try {
    const { payload } = await jwtVerify(token, jwtKey());
    if (typeof payload.sub !== "string") throw new Error("Missing subject");
    return payload.sub;
  } catch {
    fail(401, "UNAUTHORIZED", "Your session has expired.");
  }
}

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    fail(413, "BODY_TOO_LARGE", "Request body is too large.");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    fail(413, "BODY_TOO_LARGE", "Request body is too large.");
  }
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  } catch {
    fail(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  fail(400, "INVALID_JSON", "Request body must be a JSON object.");
}

async function consumeRateLimit(
  request: Request,
  action: string,
  subject: string,
  maximum: number,
  windowSeconds: number,
): Promise<void> {
  const ip =
    request.headers.get("x-nf-client-connection-ip")?.trim() || "unknown";
  const bucket = createHash("sha256")
    .update(`${action}:${ip}:${subject}`)
    .digest("hex");
  const rows = await database()(
    `INSERT INTO auth_rate_limits (bucket, window_started_at, attempts)
     VALUES ($1, now(), 1)
     ON CONFLICT (bucket) DO UPDATE SET
       attempts = CASE
         WHEN auth_rate_limits.window_started_at <= now() - ($2 * interval '1 second')
         THEN 1 ELSE auth_rate_limits.attempts + 1 END,
       window_started_at = CASE
         WHEN auth_rate_limits.window_started_at <= now() - ($2 * interval '1 second')
         THEN now() ELSE auth_rate_limits.window_started_at END
     RETURNING attempts`,
    [bucket, windowSeconds],
  );
  if (Number(rows[0]?.attempts) > maximum) {
    fail(
      429,
      "RATE_LIMITED",
      "Too many attempts. Please wait before trying again.",
    );
  }
}

function text(value: unknown, field: string, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > maxLength
  ) {
    fail(
      400,
      "INVALID_INPUT",
      `${field} is required and must be at most ${maxLength} characters.`,
    );
  }
  return value.trim();
}

function passwordValue(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length < 8 ||
    new TextEncoder().encode(value).byteLength > 72
  ) {
    fail(
      400,
      "WEAK_PASSWORD",
      "Password must be at least 8 characters and at most 72 UTF-8 bytes.",
    );
  }
  return value;
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    fail(400, "INVALID_PATH", "Path contains invalid encoding.");
  }
}

function jsonValue(value: unknown, field: string): string {
  if (value === undefined || value === null || typeof value !== "object") {
    fail(400, "INVALID_INPUT", `${field} must be provided as an object.`);
  }
  return JSON.stringify(value);
}

function limitFrom(url: URL, fallback = 30): number {
  const value = Number(url.searchParams.get("limit") ?? fallback);
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 100) : fallback;
}

function encodeCursor(row: Record<string, unknown>): string {
  return Buffer.from(`${String(row.listened_at)}|${String(row.id)}`).toString(
    "base64url",
  );
}

function decodeCursor(cursor: string | null): [string, string] | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString();
    const separator = decoded.lastIndexOf("|");
    if (separator <= 0) return null;
    const date = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (!Number.isFinite(date.getTime()) || !/^[0-9a-f-]{36}$/i.test(id))
      return null;
    return [date.toISOString(), id];
  } catch {
    return null;
  }
}

function encodeLikedCursor(row: Record<string, unknown>): string {
  return Buffer.from(
    `${String(row.liked_at)}|${String(row.track_id)}`,
  ).toString("base64url");
}

function decodeLikedCursor(cursor: string | null): [string, string] | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString();
    const separator = decoded.lastIndexOf("|");
    if (separator <= 0) return null;
    const date = new Date(decoded.slice(0, separator));
    const trackId = decoded.slice(separator + 1);
    if (!Number.isFinite(date.getTime()) || !trackId) return null;
    return [date.toISOString(), trackId];
  } catch {
    return null;
  }
}

async function getUser(idOrUsername: string): Promise<UserRow> {
  const rows = await database()(
    "SELECT * FROM app_users WHERE id::text = $1 OR lower(username) = lower($1) LIMIT 1",
    [idOrUsername],
  );
  const row = rows[0] as UserRow | undefined;
  if (!row) fail(404, "USER_NOT_FOUND", "User was not found.");
  return row;
}

async function listHistory(userId: string, url: URL) {
  const limit = limitFrom(url);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const rows = await database()(
    `SELECT id, playback_session_id, listening_session_id, snapshot, played_duration_ms,
      completion_rate, completed, skipped, loop_count, has_seek_backward, context, listened_at
     FROM playback_events WHERE user_id = $1
     ${cursor ? "AND (listened_at, id) < ($2::timestamptz, $3::uuid)" : ""}
     ORDER BY listened_at DESC, id DESC LIMIT $${cursor ? 4 : 2}`,
    cursor ? [userId, cursor[0], cursor[1], limit + 1] : [userId, limit + 1],
  );
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return {
    items: page.map((row) => ({
      id: row.id,
      playbackSessionId: row.playback_session_id,
      listeningSessionId: row.listening_session_id,
      track: row.snapshot,
      playedDurationMs: row.played_duration_ms,
      completionRate: row.completion_rate,
      completed: row.completed,
      skipped: row.skipped,
      loopCount: row.loop_count,
      hasSeekBackward: row.has_seek_backward,
      ...(row.context ? { context: row.context } : {}),
      listenedAt: row.listened_at,
    })),
    nextCursor:
      hasMore && page.length ? encodeCursor(page[page.length - 1]) : null,
  };
}

async function playlistSummary(
  row: Record<string, unknown>,
  owner?: Record<string, unknown>,
) {
  const items = await database()(
    `SELECT snapshot FROM playlist_items WHERE playlist_id = $1 ORDER BY position LIMIT 4`,
    [String(row.id)],
  );
  const countRows = await database()(
    "SELECT count(*)::int AS count FROM playlist_items WHERE playlist_id = $1",
    [String(row.id)],
  );
  const snapshots = items.map(
    (item) => item.snapshot as Record<string, unknown>,
  );
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
    trackCount: countRows[0]?.count ?? 0,
    coverUrls: snapshots
      .map((track) => {
        const cover = track.cover as { url?: string } | undefined;
        return cover?.url;
      })
      .filter((url): url is string => typeof url === "string"),
    ...(row.owner_id ? { ownerId: row.owner_id } : {}),
    ...(owner
      ? {
          owner: {
            id: owner.id,
            username: owner.username,
            displayName: owner.display_name,
            avatarUrl: owner.avatar_url,
          },
        }
      : {}),
  };
}

async function ownedPlaylist(userId: string, playlistId: string) {
  const rows = await database()(
    "SELECT * FROM user_playlists WHERE id::text = $1 AND owner_id = $2",
    [playlistId, userId],
  );
  if (!rows[0]) fail(404, "PLAYLIST_NOT_FOUND", "Playlist was not found.");
  return rows[0];
}

async function playlistItems(playlistId: string) {
  const rows = await database()(
    "SELECT id, track_id, snapshot, position, added_at FROM playlist_items WHERE playlist_id = $1 ORDER BY position",
    [playlistId],
  );
  return rows.map((row) => ({
    id: row.id,
    track: row.snapshot,
    position: row.position,
    addedAt: row.added_at,
  }));
}

async function route(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const requestedPath = url.pathname.replace(/\/+$/, "") || "/";
  const path =
    requestedPath === "/v1"
      ? "/"
      : requestedPath.startsWith("/v1/")
        ? requestedPath.slice(3)
        : requestedPath;

  if (method === "OPTIONS") return json(undefined, 204);
  const db = database();
  if (path === "/health" && method === "GET") {
    await db("SELECT 1");
    return json({ status: "ok" });
  }

  if (path === "/auth/register" && method === "POST") {
    const input = await bodyOf(request);
    const email = text(input.email, "email", 254).toLowerCase();
    const password = passwordValue(input.password);
    const username = text(input.username, "username", 32).toLowerCase();
    const displayName = text(input.displayName, "displayName", 80);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      fail(400, "INVALID_EMAIL", "Enter a valid email address.");
    await consumeRateLimit(request, "register", "all", 10, 3600);
    if (!/^[a-z0-9_]{3,32}$/.test(username))
      fail(
        400,
        "INVALID_USERNAME",
        "Username must be 3-32 letters, numbers, or underscores.",
      );
    const rows = await db(
      `INSERT INTO app_users (email, password_hash, username, display_name)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [email, await hash(password, 12), username, displayName],
    );
    return json(await issueTokens(rows[0] as UserRow), 201);
  }

  if (path === "/auth/login" && method === "POST") {
    const input = await bodyOf(request);
    const email = text(input.email, "email", 254).toLowerCase();
    const password = passwordValue(input.password);
    await consumeRateLimit(request, "login", email, 10, 600);
    const rows = await db("SELECT * FROM app_users WHERE email = $1", [email]);
    if (!rows[0] || !(await compare(password, String(rows[0].password_hash)))) {
      fail(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    return json(await issueTokens(rows[0] as UserRow));
  }

  if (path === "/auth/refresh" && method === "POST") {
    const input = await bodyOf(request);
    const refreshToken = text(input.refreshToken, "refreshToken", 256);
    const oldHash = tokenHash(refreshToken);
    const rows = await db(
      `DELETE FROM refresh_sessions WHERE token_hash = $1 AND expires_at > now()
       RETURNING user_id`,
      [oldHash],
    );
    if (!rows[0])
      fail(
        401,
        "INVALID_REFRESH_TOKEN",
        "Refresh session expired. Sign in again.",
      );
    const users = await db("SELECT * FROM app_users WHERE id = $1", [
      String(rows[0].user_id),
    ]);
    if (!users[0])
      fail(
        401,
        "INVALID_REFRESH_TOKEN",
        "Refresh session expired. Sign in again.",
      );
    return json(await issueTokens(users[0] as UserRow));
  }

  if (path === "/auth/logout" && method === "POST") {
    const input = await bodyOf(request);
    if (typeof input.refreshToken === "string") {
      await db("DELETE FROM refresh_sessions WHERE token_hash = $1", [
        tokenHash(input.refreshToken),
      ]);
    }
    return json(undefined, 204);
  }

  if (path === "/me" && method === "GET") {
    const userId = await authenticatedUser(request);
    const rows = await db("SELECT * FROM app_users WHERE id = $1", [userId]);
    if (!rows[0]) fail(401, "UNAUTHORIZED", "Your session is no longer valid.");
    return json(userView(rows[0] as UserRow, true));
  }

  if (path === "/users/me" && method === "PATCH") {
    const userId = await authenticatedUser(request);
    const input = await bodyOf(request);
    const allowed = new Set([
      "username",
      "displayName",
      "avatarUrl",
      "bio",
      "isPublic",
      "showActivity",
      "showHistory",
      "showLikedTracks",
      "participateLeaderboards",
    ]);
    if (Object.keys(input).some((key) => !allowed.has(key))) {
      fail(400, "INVALID_INPUT", "Profile contains an unsupported field.");
    }
    const currentRows = await db("SELECT * FROM app_users WHERE id = $1", [
      userId,
    ]);
    const current = currentRows[0] as UserRow | undefined;
    if (!current) fail(401, "UNAUTHORIZED", "Your session is no longer valid.");
    const username =
      input.username === undefined
        ? current.username
        : text(input.username, "username", 32).toLowerCase();
    if (!/^[a-z0-9_]{3,32}$/.test(username))
      fail(
        400,
        "INVALID_USERNAME",
        "Username must be 3-32 letters, numbers, or underscores.",
      );
    const nullableText = (key: string, old: string | null, max: number) =>
      input[key] === undefined
        ? old
        : input[key] === null
          ? null
          : text(input[key], key, max);
    const bool = (key: string, old: boolean) => {
      if (input[key] === undefined) return old;
      if (typeof input[key] !== "boolean")
        fail(400, "INVALID_INPUT", `${key} must be a boolean.`);
      return input[key] as boolean;
    };
    const rows = await db(
      `UPDATE app_users SET username = $2, display_name = $3, avatar_url = $4, bio = $5,
       is_public = $6, show_activity = $7, show_history = $8, show_liked_tracks = $9,
       participate_leaderboards = $10, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        userId,
        username,
        nullableText("displayName", current.display_name, 80),
        nullableText("avatarUrl", current.avatar_url, 2048),
        nullableText("bio", current.bio, 500),
        bool("isPublic", current.is_public),
        bool("showActivity", current.show_activity),
        bool("showHistory", current.show_history),
        bool("showLikedTracks", current.show_liked_tracks),
        bool("participateLeaderboards", current.participate_leaderboards),
      ],
    );
    return json(userView(rows[0] as UserRow, true));
  }

  if (path === "/me/library/tracks" && method === "GET") {
    const userId = await authenticatedUser(request);
    const limit = limitFrom(url, 100);
    const cursor = decodeLikedCursor(url.searchParams.get("cursor"));
    const rows = await db(
      `SELECT track_id, snapshot, liked_at FROM liked_tracks WHERE user_id = $1
       ${cursor ? "AND (liked_at, track_id) < ($2::timestamptz, $3)" : ""}
       ORDER BY liked_at DESC, track_id DESC LIMIT $${cursor ? 4 : 2}`,
      cursor ? [userId, cursor[0], cursor[1], limit + 1] : [userId, limit + 1],
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return json({
      items: page.map((row) => ({
        track: row.snapshot,
        likedAt: row.liked_at,
      })),
      nextCursor:
        hasMore && page.length
          ? encodeLikedCursor(page[page.length - 1])
          : null,
    });
  }

  const likedTrack = path.match(/^\/me\/library\/tracks\/([^/]+)$/);
  if (likedTrack && (method === "PUT" || method === "DELETE")) {
    const userId = await authenticatedUser(request);
    const trackId = decodeSegment(likedTrack[1]);
    if (method === "DELETE") {
      await db(
        "DELETE FROM liked_tracks WHERE user_id = $1 AND track_id = $2",
        [userId, trackId],
      );
      return json(undefined, 204);
    }
    const input = await bodyOf(request);
    const snapshot = input.trackSnapshot ??
      input.track ?? {
        id: trackId,
        title: trackId,
        artists: [],
        durationMs: 0,
      };
    await db(
      `INSERT INTO liked_tracks (user_id, track_id, snapshot) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (user_id, track_id) DO UPDATE SET snapshot = EXCLUDED.snapshot`,
      [userId, trackId, jsonValue(snapshot, "track")],
    );
    return json(undefined, 204);
  }

  const library = path.match(
    /^\/me\/library\/(albums|artists|playlists)(?:\/([^/]+))?$/,
  );
  if (library) {
    const userId = await authenticatedUser(request);
    const [, type, encodedId] = library;
    if (method === "GET" && !encodedId) {
      const rows = await db(
        "SELECT collection_id, snapshot, saved_at FROM saved_collections WHERE user_id = $1 AND type = $2 ORDER BY saved_at DESC",
        [userId, type],
      );
      return json({
        items: rows.map((row) => ({
          id: row.collection_id,
          type,
          ...(row.snapshot as object),
          savedAt: row.saved_at,
        })),
      });
    }
    if (encodedId && method === "DELETE") {
      await db(
        "DELETE FROM saved_collections WHERE user_id = $1 AND type = $2 AND collection_id = $3",
        [userId, type, decodeSegment(encodedId)],
      );
      return json(undefined, 204);
    }
    if (encodedId && method === "PUT") {
      const input = await bodyOf(request);
      const snapshot = input.snapshot ?? { id: decodeSegment(encodedId) };
      await db(
        `INSERT INTO saved_collections (user_id, type, collection_id, snapshot)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (user_id, type, collection_id) DO UPDATE SET snapshot = EXCLUDED.snapshot`,
        [
          userId,
          type,
          decodeSegment(encodedId),
          jsonValue(snapshot, "snapshot"),
        ],
      );
      return json(undefined, 204);
    }
  }

  if (path === "/me/playlists" && method === "GET") {
    const userId = await authenticatedUser(request);
    const rows = await db(
      "SELECT * FROM user_playlists WHERE owner_id = $1 ORDER BY updated_at DESC",
      [userId],
    );
    return json({
      items: await Promise.all(rows.map((row) => playlistSummary(row))),
    });
  }

  if (path === "/me/playlists" && method === "POST") {
    const userId = await authenticatedUser(request);
    const input = await bodyOf(request);
    const title = text(input.title, "title", 120);
    const description =
      input.description === undefined
        ? null
        : text(input.description, "description", 1000);
    const isPublic = input.isPublic === true;
    const rows = await db(
      "INSERT INTO user_playlists (owner_id, title, description, is_public) VALUES ($1, $2, $3, $4) RETURNING *",
      [userId, title, description, isPublic],
    );
    return json(await playlistSummary(rows[0]), 201);
  }

  const playlist = path.match(/^\/me\/playlists\/([^/]+)(?:\/(.*))?$/);
  if (playlist) {
    const userId = await authenticatedUser(request);
    const playlistId = decodeSegment(playlist[1]);
    const subpath = playlist[2] ?? "";
    const row = await ownedPlaylist(userId, playlistId);
    if (!subpath && method === "GET") {
      const items = await playlistItems(playlistId);
      const etag = `"${row.revision}-${items.length}"`;
      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, {
          status: 304,
          headers: { etag, "access-control-allow-origin": "*" },
        });
      }
      const compact = url.searchParams.get("compact") === "true";
      const limit = compact ? limitFrom(url, items.length || 1) : items.length;
      const selected = items.slice(0, limit);
      return json(
        {
          playlist: await playlistSummary(row),
          items: selected,
          trackCount: items.length,
          durationMs: items.reduce(
            (sum, item) =>
              sum +
              Number((item.track as { durationMs?: number })?.durationMs ?? 0),
            0,
          ),
          partial: selected.length < items.length,
        },
        200,
        { etag },
      );
    }
    if (!subpath && method === "PATCH") {
      const input = await bodyOf(request);
      const title =
        input.title === undefined
          ? String(row.title)
          : text(input.title, "title", 120);
      const description =
        input.description === undefined
          ? (row.description as string | null)
          : input.description === null
            ? null
            : text(input.description, "description", 1000);
      const isPublic =
        input.isPublic === undefined ? row.is_public : input.isPublic;
      if (typeof isPublic !== "boolean")
        fail(400, "INVALID_INPUT", "isPublic must be a boolean.");
      const rows = await db(
        `UPDATE user_playlists SET title = $2, description = $3, is_public = $4,
         revision = revision + 1, updated_at = now() WHERE id = $1 RETURNING *`,
        [playlistId, title, description, isPublic],
      );
      return json(await playlistSummary(rows[0]));
    }
    if (!subpath && method === "DELETE") {
      await db("DELETE FROM user_playlists WHERE id = $1", [playlistId]);
      return json(undefined, 204);
    }
    const tracksRoute = subpath.match(/^tracks(?:\/([^/]+))?$/);
    if (tracksRoute && method === "POST") {
      const input = await bodyOf(request);
      const tracks = Array.isArray(input.tracks)
        ? input.tracks
        : [
            input.trackSnapshot ??
              input.track ?? {
                id: tracksRoute[1] ? decodeSegment(tracksRoute[1]) : "",
                title: tracksRoute[1] ? decodeSegment(tracksRoute[1]) : "",
                artists: [],
                durationMs: 0,
              },
          ];
      if (tracksRoute[1]) {
        const embeddedTrack = input.trackSnapshot ?? input.track;
        if (
          !embeddedTrack ||
          typeof embeddedTrack !== "object" ||
          (embeddedTrack as Record<string, unknown>).id !==
            decodeSegment(tracksRoute[1])
        ) {
          fail(400, "INVALID_INPUT", "A matching track snapshot is required.");
        }
      }
      if (!tracks.length || tracks.length > 500)
        fail(400, "INVALID_INPUT", "Add between 1 and 500 track snapshots.");
      let position =
        Number(
          (
            await db(
              "SELECT COALESCE(max(position), -1)::int AS position FROM playlist_items WHERE playlist_id = $1",
              [playlistId],
            )
          )[0].position,
        ) + 1;
      const added = [];
      for (const track of tracks) {
        const trackId = text(
          (track as Record<string, unknown>)?.id,
          "track.id",
          256,
        );
        const result = await db(
          "INSERT INTO playlist_items (playlist_id, track_id, snapshot, position) VALUES ($1, $2, $3::jsonb, $4) RETURNING id, snapshot, position, added_at",
          [playlistId, trackId, jsonValue(track, "track"), position++],
        );
        added.push(result[0]);
      }
      await db(
        "UPDATE user_playlists SET revision = revision + 1, updated_at = now() WHERE id = $1",
        [playlistId],
      );
      const items = added.map((item) => ({
        id: item.id,
        track: item.snapshot,
        position: item.position,
        addedAt: item.added_at,
      }));
      return json(
        tracks.length === 1
          ? items[0]
          : { items, added: items.length, rejected: 0 },
        201,
      );
    }
    const itemRoute = subpath.match(/^items\/([^/]+)(?:\/(move))?$/);
    if (itemRoute && method === "DELETE" && !itemRoute[2]) {
      await db(
        "DELETE FROM playlist_items WHERE playlist_id = $1 AND id::text = $2",
        [playlistId, decodeSegment(itemRoute[1])],
      );
      await db(
        "UPDATE user_playlists SET revision = revision + 1, updated_at = now() WHERE id = $1",
        [playlistId],
      );
      return json(undefined, 204);
    }
    if (itemRoute && method === "POST" && itemRoute[2] === "move") {
      const input = await bodyOf(request);
      const items = await playlistItems(playlistId);
      const itemId = decodeSegment(itemRoute[1]);
      const from = items.findIndex((item) => item.id === itemId);
      const before =
        input.beforeItemId === null
          ? items.length
          : items.findIndex((item) => item.id === input.beforeItemId);
      if (from < 0 || before < 0)
        fail(404, "PLAYLIST_ITEM_NOT_FOUND", "Playlist item was not found.");
      if (Number(input.revision) !== Number(row.revision))
        fail(
          409,
          "PLAYLIST_REVISION_CONFLICT",
          "Playlist changed; reload it and try again.",
        );
      const reordered = [...items];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(before > from ? before - 1 : before, 0, moved);
      await db(
        "UPDATE playlist_items SET position = position + 1000000 WHERE playlist_id = $1",
        [playlistId],
      );
      for (let index = 0; index < reordered.length; index++) {
        await db(
          "UPDATE playlist_items SET position = $3 WHERE playlist_id = $1 AND id = $2",
          [playlistId, String(reordered[index].id), index],
        );
      }
      const updated = await db(
        "UPDATE user_playlists SET revision = revision + 1, updated_at = now() WHERE id = $1 RETURNING *",
        [playlistId],
      );
      return json({
        playlist: await playlistSummary(updated[0]),
        items: await playlistItems(playlistId),
      });
    }
  }

  if (path === "/me/playback/events" && method === "POST") {
    const userId = await authenticatedUser(request);
    const input = await bodyOf(request);
    const trackId = text(input.trackId, "trackId", 256);
    const track = input.trackSnapshot ?? {
      id: trackId,
      title: trackId,
      artists: [],
      durationMs: 0,
    };
    const playbackSessionId = text(
      input.playbackSessionId,
      "playbackSessionId",
      256,
    );
    const listeningSessionId = text(
      input.listeningSessionId,
      "listeningSessionId",
      256,
    );
    const playedDurationMs = Math.max(
      0,
      Math.min(Number(input.playedDurationMs) || 0, 86_400_000),
    );
    const completionRate = Math.max(
      0,
      Math.min(Number(input.completionRate) || 0, 1),
    );
    await db(
      `INSERT INTO playback_events (user_id, playback_session_id, listening_session_id, track_id, snapshot,
       played_duration_ms, completion_rate, completed, skipped, loop_count, has_seek_backward, context)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12::jsonb)
       ON CONFLICT (user_id, playback_session_id) DO NOTHING`,
      [
        userId,
        playbackSessionId,
        listeningSessionId,
        trackId,
        jsonValue(track, "trackSnapshot"),
        Math.round(playedDurationMs),
        completionRate,
        input.completed === true,
        input.skipped === true,
        Math.max(0, Math.floor(Number(input.loopCount) || 0)),
        input.hasSeekBackward === true,
        input.context === undefined ? null : JSON.stringify(input.context),
      ],
    );
    return json(undefined, 204);
  }

  if (path === "/me/history" && method === "GET") {
    return json(await listHistory(await authenticatedUser(request), url));
  }

  const userRoute = path.match(/^\/users\/([^/]+)(?:\/(.*))?$/);
  if (userRoute) {
    const identifier = decodeSegment(userRoute[1]);
    const subpath = userRoute[2] ?? "";
    if (identifier === "search" && !subpath && method === "GET") {
      const query = text(url.searchParams.get("q"), "q", 80);
      const viewer = await authenticatedUser(request);
      const rows = await db(
        `SELECT u.*, (SELECT count(*)::int FROM user_follows f WHERE f.followed_id = u.id) AS followers_count,
         (SELECT count(*)::int FROM user_follows f WHERE f.follower_id = u.id) AS following_count,
         EXISTS (SELECT 1 FROM user_follows f WHERE f.follower_id = $2 AND f.followed_id = u.id) AS is_following
         FROM app_users u WHERE u.is_public = true AND (u.username ILIKE $1 OR u.display_name ILIKE $1)
         ORDER BY u.username LIMIT 30`,
        [`%${query.replace(/[%_]/g, "\\$&")}%`, viewer],
      );
      return json(
        rows.map((row) =>
          profileView(
            row as UserRow,
            Number(row.followers_count),
            Number(row.following_count),
            row.is_following === true,
          ),
        ),
      );
    }
    const profile = await getUser(identifier);
    if (!subpath && method === "GET") {
      const viewer = request.headers.get("authorization")
        ? await authenticatedUser(request)
        : null;
      if (!profile.is_public && viewer !== profile.id)
        fail(404, "USER_NOT_FOUND", "User was not found.");
      const counts = await db(
        `SELECT (SELECT count(*)::int FROM user_follows WHERE followed_id = $1) AS followers,
         (SELECT count(*)::int FROM user_follows WHERE follower_id = $1) AS following,
         EXISTS (SELECT 1 FROM user_follows WHERE follower_id = $2 AND followed_id = $1) AS is_following`,
        [profile.id, viewer ?? profile.id],
      );
      return json(
        profileView(
          profile,
          Number(counts[0].followers),
          Number(counts[0].following),
          viewer ? counts[0].is_following === true : undefined,
        ),
      );
    }
    if (subpath === "follow" && method === "POST") {
      const followerId = await authenticatedUser(request);
      if (followerId === profile.id)
        fail(400, "INVALID_FOLLOW", "You cannot follow yourself.");
      await db(
        "INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [followerId, profile.id],
      );
      return json(undefined, 204);
    }
    if (subpath === "follow" && method === "DELETE") {
      const followerId = await authenticatedUser(request);
      await db(
        "DELETE FROM user_follows WHERE follower_id = $1 AND followed_id = $2",
        [followerId, profile.id],
      );
      return json(undefined, 204);
    }
    if (
      (subpath === "followers" || subpath === "following") &&
      method === "GET"
    ) {
      if (!profile.is_public)
        fail(404, "USER_NOT_FOUND", "User was not found.");
      const column = subpath === "followers" ? "followed_id" : "follower_id";
      const rows = await db(
        `SELECT u.*, (SELECT count(*)::int FROM user_follows f WHERE f.followed_id = u.id) AS followers_count,
         (SELECT count(*)::int FROM user_follows f WHERE f.follower_id = u.id) AS following_count
         FROM app_users u JOIN user_follows link ON link.${column} = u.id
         WHERE link.${subpath === "followers" ? "follower_id" : "followed_id"} = $1 AND u.is_public = true LIMIT 100`,
        [profile.id],
      );
      return json(
        rows.map((row) =>
          profileView(
            row as UserRow,
            Number(row.followers_count),
            Number(row.following_count),
          ),
        ),
      );
    }
    if (subpath === "playlists" && method === "GET") {
      if (!profile.is_public)
        fail(404, "USER_NOT_FOUND", "User was not found.");
      const rows = await db(
        "SELECT * FROM user_playlists WHERE owner_id = $1 AND is_public = true ORDER BY updated_at DESC LIMIT 100",
        [profile.id],
      );
      return json({
        items: await Promise.all(
          rows.map((row) =>
            playlistSummary(row, profile as unknown as Record<string, unknown>),
          ),
        ),
      });
    }
    if (subpath === "history" && method === "GET") {
      if (!profile.show_history)
        fail(404, "USER_NOT_FOUND", "User history is private.");
      return json(await listHistory(profile.id, url));
    }
  }

  if (
    path.startsWith("/catalog/") ||
    path.startsWith("/tracks/") ||
    path.startsWith("/me/lyrics/")
  ) {
    fail(
      501,
      "PROVIDER_NOT_CONFIGURED",
      "This endpoint needs a music or lyrics provider integration that is not configured.",
    );
  }

  fail(
    501,
    "ENDPOINT_NOT_IMPLEMENTED",
    `The ${method} ${path} endpoint is not implemented by this service yet.`,
  );
}

export default async function handler(request: Request): Promise<Response> {
  try {
    return await route(request);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ message: error.message, code: error.code }, error.status);
    }
    const sqlCode = (error as { code?: string } | null)?.code;
    if (sqlCode === "23505") {
      return json(
        {
          message: "That email or username is already in use.",
          code: "ACCOUNT_ALREADY_EXISTS",
        },
        409,
      );
    }
    if (sqlCode === "23514" || sqlCode === "22P02") {
      return json(
        { message: "Request contains invalid data.", code: "INVALID_INPUT" },
        400,
      );
    }
    const requestId = randomUUID();
    console.error(`[API ${requestId}]`, error);
    return json(
      {
        message: "The service could not complete the request.",
        code: "INTERNAL_ERROR",
        requestId,
      },
      500,
      {
        "x-request-id": requestId,
      },
    );
  }
}
