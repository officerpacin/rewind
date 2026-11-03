import { api, toClientTrack } from "@/shared/api";
import type { PlaybackHistoryItem } from "@/shared/contracts";
import type { Track } from "@/shared/types";

export interface DailyStat {
  key: string;
  label: string;
  dateLabel: string;
  plays: number;
}

export interface TrackStat {
  track: Track;
  plays: number;
  minutes: number;
}

export interface ArtistStat {
  name: string;
  plays: number;
}

export interface WeeklyStats {
  plays: number;
  minutes: number;
  tracks: TrackStat[];
  artists: ArtistStat[];
  days: DailyStat[];
  start: Date;
  end: Date;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function makeWeekStart(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
}

export function buildWeeklyStats(
  history: PlaybackHistoryItem[],
  now: Date,
): WeeklyStats {
  const start = makeWeekStart(now);
  const dayStats = new Map<string, DailyStat>();
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    dayStats.set(dayKey(date), {
      key: dayKey(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
        date,
      ),
      dateLabel: new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(
        date,
      ),
      plays: 0,
    });
  }

  const tracks = new Map<string, TrackStat>();
  const artists = new Map<string, ArtistStat>();
  let plays = 0;
  let playedDurationMs = 0;

  for (const entry of history) {
    const listenedAt = new Date(entry.listenedAt);
    if (
      !Number.isFinite(listenedAt.getTime()) ||
      listenedAt < start ||
      listenedAt > now
    ) {
      continue;
    }

    plays += 1;
    playedDurationMs += Math.max(0, entry.playedDurationMs || 0);
    const day = dayStats.get(dayKey(listenedAt));
    if (day) day.plays += 1;

    const track = toClientTrack(entry.track);
    if (track.id) {
      const current = tracks.get(track.id);
      if (current) {
        current.plays += 1;
        current.minutes += Math.max(0, entry.playedDurationMs || 0) / 60_000;
      } else {
        tracks.set(track.id, {
          track,
          plays: 1,
          minutes: Math.max(0, entry.playedDurationMs || 0) / 60_000,
        });
      }
    }

    for (const artist of track.artistList ?? []) {
      const name = artist.name.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      const current = artists.get(key);
      if (current) current.plays += 1;
      else artists.set(key, { name, plays: 1 });
    }
  }

  return {
    plays,
    minutes: playedDurationMs / 60_000,
    tracks: [...tracks.values()].sort(
      (a, b) => b.plays - a.plays || b.minutes - a.minutes,
    ),
    artists: [...artists.values()].sort((a, b) => b.plays - a.plays),
    days: [...dayStats.values()],
    start,
    end: now,
  };
}

export async function loadWeeklyHistory(): Promise<PlaybackHistoryItem[]> {
  const start = makeWeekStart(new Date());
  const history: PlaybackHistoryItem[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  do {
    const page = await api.getHistory(cursor, 100);
    history.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (cursor && seenCursors.has(cursor)) {
      throw new Error("History pagination returned a repeated cursor.");
    }
    if (cursor) seenCursors.add(cursor);

    const oldestEntry = page.items.at(-1);
    if (
      !cursor ||
      !oldestEntry ||
      new Date(oldestEntry.listenedAt).getTime() < start.getTime()
    ) {
      break;
    }
  } while (cursor);

  return history;
}
