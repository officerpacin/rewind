import { describe, expect, it } from "vitest";
import type { PlaybackHistoryItem } from "@/shared/contracts";
import { buildWeeklyStats, makeWeekStart } from "./weeklyStats";

function historyItem({
  id,
  trackId,
  title,
  artist,
  listenedAt,
  playedDurationMs,
}: {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  listenedAt: Date;
  playedDurationMs: number;
}): PlaybackHistoryItem {
  return {
    id,
    playbackSessionId: `playback-${id}`,
    listeningSessionId: `listening-${id}`,
    track: {
      id: trackId,
      title,
      artists: [{ id: `artist-${artist}`, name: artist }],
      durationMs: 180_000,
    },
    playedDurationMs,
    completionRate: 1,
    completed: true,
    skipped: false,
    loopCount: 0,
    hasSeekBackward: false,
    listenedAt: listenedAt.toISOString(),
  };
}

describe("weeklyStats", () => {
  it("counts the last seven calendar days and ranks artists and tracks", () => {
    const now = new Date(2026, 10, 3, 12);
    const history = [
      historyItem({
        id: "1",
        trackId: "track-a",
        title: "First song",
        artist: "Artist A",
        listenedAt: new Date(2026, 10, 3, 9),
        playedDurationMs: 120_000,
      }),
      historyItem({
        id: "2",
        trackId: "track-a",
        title: "First song",
        artist: "Artist A",
        listenedAt: new Date(2026, 10, 2, 20),
        playedDurationMs: 60_000,
      }),
      historyItem({
        id: "3",
        trackId: "track-b",
        title: "Second song",
        artist: "Artist B",
        listenedAt: new Date(2026, 10, 2, 19),
        playedDurationMs: 30_000,
      }),
      historyItem({
        id: "4",
        trackId: "track-old",
        title: "Old song",
        artist: "Old Artist",
        listenedAt: new Date(2026, 9, 27, 23, 59),
        playedDurationMs: 600_000,
      }),
    ];

    const result = buildWeeklyStats(history, now);

    expect(result.plays).toBe(3);
    expect(result.minutes).toBe(3.5);
    expect(result.tracks.map(({ track, plays }) => [track.id, plays])).toEqual([
      ["track-a", 2],
      ["track-b", 1],
    ]);
    expect(result.artists.map(({ name, plays }) => [name, plays])).toEqual([
      ["Artist A", 2],
      ["Artist B", 1],
    ]);
    expect(result.days).toHaveLength(7);
    expect(result.days.find((day) => day.key === "2026-11-03")?.plays).toBe(1);
    expect(result.days.find((day) => day.key === "2026-11-02")?.plays).toBe(2);
  });

  it("starts the week at local midnight six days before today", () => {
    const start = makeWeekStart(new Date(2026, 10, 3, 17, 45));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(9);
    expect(start.getDate()).toBe(28);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });
});
