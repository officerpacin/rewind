import { useState, useEffect } from "react";
import PopularTracksSection from "./PopularTracksSection";
import DailyMixesSection from "./DailyMixesSection";
import HomePageSkeleton, { MixesSectionSkeleton } from "./HomePageSkeleton";
import { usePopularTracksAllTime } from "../hooks/usePopularTracks";
import { useListeningNow } from "../hooks/useListeningNow";
import ListeningNowSection from "./ListeningNowSection";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useDailyMixes } from "../hooks/useDailyMixes";
import { useMostSaved, usePopularAlbums } from "../hooks/useExploreCollections";
import { useTranslation } from "@/languages";
import { playerEngine } from "@/features/player";
import CoverImage from "@/features/covers/ui/CoverImage";
import HomePageHeader, { type HomeFilterCategory } from "./HomePageHeader";

export default function HomePage() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<HomeFilterCategory>("all");

  const { tracks: listeningNow, isLoading: tracksLoading } = useListeningNow();
  const { data: popularTracksAllTime, isLoading: allTimeLoading } =
    usePopularTracksAllTime(20);
  const { data: recentlyPlayed, isLoading: recentLoading } =
    useRecentlyPlayed(20);
  const { items: popularAlbums, isLoading: albumsLoading } = usePopularAlbums();
  const { items: mostSaved, isLoading: savedLoading } = useMostSaved();
  const { data: dailyMixes, isLoading: mixesLoading } = useDailyMixes();
  const hasMixes = dailyMixes.length > 0;
  const featuredRecent = recentlyPlayed.find((item) => item.type === "track");
  const recentTrack =
    featuredRecent?.type === "track" ? featuredRecent.item : null;
  const quickPlay = () => {
    if (recentTrack) {
      void playerEngine.playTrack(
        recentTrack,
        [recentTrack],
        t("home.jumpBackIn"),
        recentTrack.coverUrl,
      );
    }
  };

  const hasMixesSlot = hasMixes || mixesLoading;
  const isDataLoading =
    tracksLoading ||
    allTimeLoading ||
    recentLoading ||
    albumsLoading ||
    savedLoading;

  const isReady = !isDataLoading;
  const [skeletonExited, setSkeletonExited] = useState(() => !isDataLoading);
  const showAll = activeFilter === "all";
  const showMixes = showAll || activeFilter === "mixes";
  const showCharts = showAll || activeFilter === "charts";
  const showAlbums = showAll || activeFilter === "albums";
  const showPersonal = showAll || activeFilter === "speedDial";

  useEffect(() => {
    if (isReady && !skeletonExited) {
      const timer = setTimeout(() => {
        setSkeletonExited(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isReady, skeletonExited]);

  return (
    <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-transparent pt-(--page-inset-top) pb-(--page-inset-bottom)">
      <div className="relative z-1 mx-auto grid w-full max-w-[1500px] grid-cols-1 items-start px-3 pb-8 sm:px-5">
        {isReady && (
          <div className="col-start-1 row-start-1 w-full pb-[16px]">
            <HomePageHeader
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              onQuickPlay={quickPlay}
              hasQuickData={recentlyPlayed.length > 0}
              canQuickPlay={!!recentTrack}
            />

            {showPersonal && recentTrack && (
              <section className="relative mb-8 grid min-h-[208px] grid-cols-[minmax(0,1fr)_132px] items-center gap-5 overflow-hidden rounded-[22px] border border-border-alpha-14 bg-bg-surface px-5 py-5 shadow-[0_16px_44px_rgba(0,0,0,0.08)] sm:grid-cols-[minmax(0,1fr)_176px] sm:px-7 sm:py-6">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-[48%] bg-[radial-gradient(ellipse_at_75%_50%,color-mix(in_srgb,var(--accent-primary)_12%,transparent),transparent_70%)]" />
                <div className="relative z-10 min-w-0">
                  <p className="m-0 mb-3 text-[11px] font-[650] uppercase tracking-[0.15em] text-text-tertiary">
                    <span className="text-accent-secondary">
                      {t("home.jumpBackIn")}
                    </span>
                  </p>
                  <h2 className="m-0 max-w-[620px] truncate text-[25px] font-[620] leading-tight tracking-[-0.035em] text-text-primary sm:text-[32px]">
                    {recentTrack.title}
                  </h2>
                  <p className="m-0 mt-2 truncate text-[14px] text-text-tertiary">
                    {recentTrack.artists}
                  </p>
                </div>
                <div className="relative z-10 aspect-square w-full overflow-hidden rounded-[16px] border border-border-alpha-14 bg-bg-elevated shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
                  <CoverImage
                    src={recentTrack.coverUrl}
                    alt={recentTrack.title}
                    fill
                    priority
                    sizes="176px"
                    className="object-cover"
                  />
                </div>
              </section>
            )}

            {showMixes && mixesLoading ? (
              <MixesSectionSkeleton />
            ) : (
              showMixes &&
              hasMixes && (
                <div style={{ animation: "page-enter 200ms ease-out" }}>
                  <DailyMixesSection
                    mixes={dailyMixes}
                    headingMarginTop={recentTrack ? "mt-0" : "mt-5"}
                  />
                </div>
              )
            )}

            {showAlbums && popularAlbums.length > 0 && (
              <PopularTracksSection
                title={t("home.popularAlbums")}
                items={popularAlbums}
                headingMarginTop={hasMixesSlot ? "mt-[22px]" : "mt-0"}
              />
            )}

            {showCharts && listeningNow.length > 0 && (
              <ListeningNowSection
                title={t("home.whatEveryonesOn")}
                tracks={listeningNow}
                headingMarginTop={
                  hasMixesSlot || popularAlbums.length > 0
                    ? "mt-[22px]"
                    : "mt-0"
                }
              />
            )}

            {showPersonal &&
              recentlyPlayed.length > (featuredRecent ? 1 : 0) && (
                <PopularTracksSection
                  title={t("home.jumpBackIn")}
                  items={
                    featuredRecent
                      ? recentlyPlayed.filter((item) => item !== featuredRecent)
                      : recentlyPlayed
                  }
                  headingMarginTop="mt-[22px]"
                />
              )}

            {showCharts &&
              popularTracksAllTime &&
              popularTracksAllTime.length > 0 && (
                <PopularTracksSection
                  title={t("home.mostListened")}
                  items={popularTracksAllTime}
                  headingMarginTop="mt-[22px]"
                />
              )}

            {showAlbums && mostSaved.length > 0 && (
              <PopularTracksSection
                title={t("home.mostSaved")}
                items={mostSaved}
                headingMarginTop="mt-[22px]"
              />
            )}
          </div>
        )}

        {!skeletonExited && (
          <div
            className={`col-start-1 row-start-1 w-full z-10 transition-opacity duration-300 ease-out ${
              isReady
                ? "opacity-0 pointer-events-none"
                : "opacity-100 pointer-events-auto"
            }`}
            onTransitionEnd={() => setSkeletonExited(true)}
          >
            <HomePageSkeleton />
          </div>
        )}
      </div>
    </div>
  );
}
