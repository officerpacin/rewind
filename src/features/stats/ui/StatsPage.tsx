import { useEffect, useMemo, useState } from "react";
import { Refresh3Line } from "@mingcute/react";
import {
  buildWeeklyStats,
  loadWeeklyHistory,
  type DailyStat,
} from "../lib/weeklyStats";
import type { PlaybackHistoryItem } from "@/shared/contracts";
import { useAuthStore } from "@/features/auth";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useTranslation } from "@/languages";

function formatMinutes(minutes: number) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  if (hours === 0) return `${remaining}m`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatDateRange(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function WeeklyChart({ days }: { days: DailyStat[] }) {
  const maxPlays = Math.max(1, ...days.map((day) => day.plays));
  return (
    <div className="flex h-[190px] items-end gap-2 sm:gap-4">
      {days.map((day) => (
        <div
          key={day.key}
          className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
        >
          <span className="h-4 text-[10px] tabular-nums text-text-tertiary">
            {day.plays || ""}
          </span>
          <div className="flex h-[132px] w-full items-end rounded-[9px] bg-bg-elevated/70 p-[3px]">
            <div
              className="min-h-[3px] w-full rounded-[6px] bg-accent-primary transition-[height] duration-300"
              style={{
                height: `${Math.max(3, (day.plays / maxPlays) * 100)}%`,
              }}
              title={`${day.plays} ${day.plays === 1 ? "play" : "plays"}`}
            />
          </div>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[10px] font-[550] text-text-secondary">
              {day.label}
            </span>
            <span className="text-[9px] text-text-tertiary">
              {day.dateLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="h-[116px] animate-pulse rounded-[18px] border border-border-alpha-14 bg-bg-surface"
        />
      ))}
    </div>
  );
}

export default function StatsPage() {
  const { t } = useTranslation();
  const status = useAuthStore((state) => state.status);
  const [history, setHistory] = useState<PlaybackHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    setError(null);
    setHistory(null);
    void loadWeeklyHistory()
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load your listening history.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [status, retry]);

  const stats = useMemo(
    () => (history ? buildWeeklyStats(history, new Date()) : null),
    [history],
  );

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-transparent pt-(--page-inset-top) pb-(--page-inset-bottom)">
      <main className="mx-auto w-full max-w-[1120px] px-4 pb-10 sm:px-7">
        <header className="mb-7 flex flex-wrap items-end justify-between gap-4 pt-3">
          <div>
            <p className="mb-2 text-[11px] font-[650] uppercase tracking-[0.16em] text-accent-secondary">
              {t("stats.eyebrow")}
            </p>
            <h1 className="m-0 text-[34px] font-[700] leading-tight tracking-[-0.045em] text-text-primary sm:text-[42px]">
              {t("stats.title")}
            </h1>
            <p className="mb-0 mt-2 text-[13px] text-text-tertiary">
              {t("stats.subtitle")}
            </p>
          </div>
          {stats && (
            <span className="rounded-full border border-border-alpha-14 bg-bg-surface px-3 py-1.5 text-[11px] font-[550] text-text-secondary">
              {formatDateRange(stats.start, stats.end)}
            </span>
          )}
        </header>

        {status !== "authenticated" ? (
          <div className="rounded-[20px] border border-border-alpha-14 bg-bg-surface p-7 text-[13px] text-text-secondary">
            {t("stats.sign_in_required")}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-red-500/20 bg-red-500/[0.06] p-5 text-[13px] text-text-secondary"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="inline-flex items-center gap-2 rounded-[9px] border border-border-alpha-14 bg-bg-surface px-3 py-2 text-[12px] font-[550] text-text-primary hover:bg-bg-elevated"
            >
              <Refresh3Line size={15} />
              {t("stats.try_again")}
            </button>
          </div>
        ) : !stats ? (
          <StatsLoading />
        ) : (
          <>
            <section className="mb-5 grid gap-3 sm:grid-cols-3">
              <article className="relative overflow-hidden rounded-[18px] border border-border-alpha-14 bg-bg-surface p-5">
                <div className="pointer-events-none absolute -right-7 -top-10 size-32 rounded-full bg-accent-primary/10 blur-2xl" />
                <p className="relative mb-2 text-[11px] font-[600] uppercase tracking-[0.12em] text-text-tertiary">
                  {t("stats.time_listened")}
                </p>
                <p className="relative m-0 text-[31px] font-[700] tracking-[-0.04em] text-text-primary">
                  {formatMinutes(stats.minutes)}
                </p>
              </article>
              <article className="rounded-[18px] border border-border-alpha-14 bg-bg-surface p-5">
                <p className="mb-2 text-[11px] font-[600] uppercase tracking-[0.12em] text-text-tertiary">
                  {t("stats.plays")}
                </p>
                <p className="m-0 text-[31px] font-[700] tracking-[-0.04em] text-text-primary">
                  {stats.plays.toLocaleString()}
                </p>
              </article>
              <article className="rounded-[18px] border border-border-alpha-14 bg-bg-surface p-5">
                <p className="mb-2 text-[11px] font-[600] uppercase tracking-[0.12em] text-text-tertiary">
                  {t("stats.different_tracks")}
                </p>
                <p className="m-0 text-[31px] font-[700] tracking-[-0.04em] text-text-primary">
                  {stats.tracks.length.toLocaleString()}
                </p>
              </article>
            </section>

            {stats.plays === 0 ? (
              <div className="rounded-[20px] border border-border-alpha-14 bg-bg-surface px-6 py-12 text-center">
                <h2 className="m-0 text-[20px] font-[650] text-text-primary">
                  {t("stats.empty_title")}
                </h2>
                <p className="mb-0 mt-2 text-[13px] text-text-tertiary">
                  {t("stats.empty_description")}
                </p>
              </div>
            ) : (
              <>
                <section className="mb-5 rounded-[20px] border border-border-alpha-14 bg-bg-surface p-5 sm:p-6">
                  <div className="mb-5">
                    <h2 className="m-0 text-[17px] font-[650] text-text-primary">
                      {t("stats.weekly_chart_title")}
                    </h2>
                    <p className="mb-0 mt-1 text-[12px] text-text-tertiary">
                      {t("stats.weekly_chart_description")}
                    </p>
                  </div>
                  <WeeklyChart days={stats.days} />
                </section>

                <div className="grid gap-5 lg:grid-cols-2">
                  <section className="rounded-[20px] border border-border-alpha-14 bg-bg-surface p-5">
                    <h2 className="mb-4 mt-0 text-[17px] font-[650] text-text-primary">
                      {t("stats.top_tracks")}
                    </h2>
                    {stats.tracks.length ? (
                      <ol className="m-0 flex list-none flex-col gap-3 p-0">
                        {stats.tracks.slice(0, 5).map((item, index) => (
                          <li
                            key={item.track.id}
                            className="flex min-w-0 items-center gap-3"
                          >
                            <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-text-tertiary">
                              {index + 1}
                            </span>
                            <CoverImage
                              src={item.track.coverUrl}
                              alt=""
                              className="size-10 shrink-0 rounded-[8px] object-cover"
                              sizes="40px"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="m-0 truncate text-[13px] font-[550] text-text-primary">
                                {item.track.title}
                              </p>
                              <p className="m-0 mt-0.5 truncate text-[11px] text-text-tertiary">
                                {item.track.artists}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] tabular-nums text-text-secondary">
                              {item.plays} {item.plays === 1 ? "play" : "plays"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="m-0 text-[12px] text-text-tertiary">
                        {t("stats.no_track_details")}
                      </p>
                    )}
                  </section>

                  <section className="rounded-[20px] border border-border-alpha-14 bg-bg-surface p-5">
                    <h2 className="mb-4 mt-0 text-[17px] font-[650] text-text-primary">
                      {t("stats.top_artists")}
                    </h2>
                    {stats.artists.length ? (
                      <ol className="m-0 flex list-none flex-col gap-3 p-0">
                        {stats.artists.slice(0, 5).map((artist, index) => (
                          <li
                            key={artist.name}
                            className="flex items-center gap-3 rounded-[10px] bg-bg-elevated/60 px-3 py-3"
                          >
                            <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-text-tertiary">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-[550] text-text-primary">
                              {artist.name}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-text-secondary">
                              {artist.plays}{" "}
                              {artist.plays === 1 ? "play" : "plays"}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="m-0 text-[12px] text-text-tertiary">
                        {t("stats.no_artist_details")}
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
