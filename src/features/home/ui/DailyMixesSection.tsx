import { memo } from "react";
import { useTranslation } from "@/languages";
import type { DailyMix } from "../hooks/useDailyMixes";
import DailyMixCard from "./DailyMixCard";

export interface DailyMixesSectionProps {
  mixes: DailyMix[];
  headingMarginTop?: string;
}

function DailyMixesSection({
  mixes,
  headingMarginTop = "mt-[22px]",
}: DailyMixesSectionProps) {
  const { t } = useTranslation();
  if (mixes.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div className={`${headingMarginTop} px-3 flex items-end justify-between`}>
        <div>
          <p className="m-0 mb-1 text-[10px] font-[650] uppercase tracking-[0.15em] text-text-tertiary">
            {t("home.dailyMixesSubtitle")}
          </p>
          <h2 className="m-0 text-[21px] font-[620] leading-none tracking-[-0.025em] text-text-primary">
            {t("home.dailyMixes") || "Daily mixes"}
          </h2>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 px-3 sm:grid-cols-2 2xl:grid-cols-3">
        {mixes.map((mix, index) => (
          <DailyMixCard
            key={`daily-mix-${mix.id}-${index}`}
            mix={mix}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(DailyMixesSection);
