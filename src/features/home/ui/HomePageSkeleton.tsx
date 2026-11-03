import { memo } from "react";

const TITLE_WIDTHS = [
  "w-[78%]",
  "w-[88%]",
  "w-[68%]",
  "w-[82%]",
  "w-[72%]",
  "w-[85%]",
  "w-[64%]",
];
const ARTIST_WIDTHS = [
  "w-[52%]",
  "w-[44%]",
  "w-[60%]",
  "w-[48%]",
  "w-[56%]",
  "w-[40%]",
  "w-[50%]",
];

function SectionSkeleton({
  headingMarginTop = "mt-[22px]",
  titleWidth = "w-[180px]",
  titleHeight = "h-[24px]",
  hasIcon = false,
  iconClassName = "w-6 h-6 rounded-[5px]",
  gapClassName = "gap-2.5",
  cardsCount = 7,
}: {
  headingMarginTop?: string;
  titleWidth?: string;
  titleHeight?: string;
  hasIcon?: boolean;
  iconClassName?: string;
  gapClassName?: string;
  cardsCount?: number;
}) {
  return (
    <div className="flex flex-col select-none">
      <div
        className={`${headingMarginTop} px-3 flex items-center justify-between`}
      >
        <div className={`flex items-center ${gapClassName}`}>
          {hasIcon && (
            <div className={`skeleton-shimmer shrink-0 ${iconClassName}`} />
          )}
          <div
            className={`skeleton-shimmer ${titleHeight} ${titleWidth} rounded-[5px]`}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-4 gap-y-5 px-3 pb-2">
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div key={i} className="min-w-0 w-full">
            <div className="relative aspect-square w-full overflow-hidden rounded-[14px] bg-border-alpha-14">
              <div className="skeleton-shimmer w-full h-full" />
            </div>

            <div className="flex flex-col mt-[8px] gap-1.5">
              <div
                className={`skeleton-shimmer h-[14px] ${TITLE_WIDTHS[i % TITLE_WIDTHS.length]} rounded-[4px]`}
              />
              <div
                className={`skeleton-shimmer h-[12px] ${ARTIST_WIDTHS[i % ARTIST_WIDTHS.length]} rounded-[4px]`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const MixesSectionSkeleton = memo(function MixesSectionSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="mt-5 px-3">
        <div className="skeleton-shimmer mb-2 h-[9px] w-[125px] rounded-full" />
        <div className="skeleton-shimmer h-[21px] w-[150px] rounded-[5px]" />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 px-3 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex h-[79px] items-center gap-3 rounded-[16px] border border-border-alpha-14 bg-bg-surface/75 p-2.5"
          >
            <div className="skeleton-shimmer h-[58px] w-[58px] shrink-0 rounded-[13px]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="skeleton-shimmer h-3 w-2/3 rounded-full" />
              <div className="skeleton-shimmer h-2.5 w-1/2 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

function HomePageSkeletonComponent() {
  return (
    <div className="relative min-h-full w-full bg-transparent pb-[16px] select-none overflow-hidden">
      <div className="mb-7 flex h-[84px] items-end px-3 pt-5">
        <div className="flex flex-col gap-2">
          <div className="skeleton-shimmer h-[9px] w-[58px] rounded-full" />
          <div className="skeleton-shimmer h-[36px] w-[245px] rounded-[7px]" />
        </div>
      </div>
      <MixesSectionSkeleton />
      <SectionSkeleton
        headingMarginTop="mt-[22px]"
        titleWidth="w-[170px]"
        titleHeight="h-[24px]"
        cardsCount={7}
      />
      <SectionSkeleton
        headingMarginTop="mt-[22px]"
        titleWidth="w-[210px]"
        titleHeight="h-[24px]"
        cardsCount={7}
      />
    </div>
  );
}

export default memo(HomePageSkeletonComponent);
