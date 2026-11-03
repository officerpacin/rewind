CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  username text NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  is_public boolean NOT NULL DEFAULT true,
  show_activity boolean NOT NULL DEFAULT true,
  show_history boolean NOT NULL DEFAULT false,
  show_liked_tracks boolean NOT NULL DEFAULT false,
  participate_leaderboards boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS liked_tracks (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  track_id text NOT NULL,
  snapshot jsonb NOT NULL,
  liked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE IF NOT EXISTS saved_collections (
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('albums', 'artists', 'playlists')),
  collection_id text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type, collection_id)
);

CREATE TABLE IF NOT EXISTS user_playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_playlists_owner_updated_idx
  ON user_playlists(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
  track_id text NOT NULL,
  snapshot jsonb NOT NULL,
  position integer NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id, position)
);

CREATE INDEX IF NOT EXISTS playlist_items_order_idx
  ON playlist_items(playlist_id, position);

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE TABLE IF NOT EXISTS playback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  playback_session_id text NOT NULL,
  listening_session_id text NOT NULL,
  track_id text NOT NULL,
  snapshot jsonb NOT NULL,
  played_duration_ms integer NOT NULL DEFAULT 0,
  completion_rate real NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  skipped boolean NOT NULL DEFAULT false,
  loop_count integer NOT NULL DEFAULT 0,
  has_seek_backward boolean NOT NULL DEFAULT false,
  context jsonb,
  listened_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, playback_session_id)
);

CREATE INDEX IF NOT EXISTS playback_events_user_listened_idx
  ON playback_events(user_id, listened_at DESC);
