import { memo } from "react";
import CoverImage from "@/features/covers/ui/CoverImage";

export interface DailyMixCoverProps {
  coverUrl?: string;
  mixNumber: string | number;
  imageLoaded: boolean;
  onLoad?: () => void;
}

function DailyMixCover({
  coverUrl,
  mixNumber,
  imageLoaded,
  onLoad,
}: DailyMixCoverProps) {
  const number = String(mixNumber).padStart(2, "0");

  return (
    <div className="relative h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[13px] bg-border-alpha-14 select-none">
      {coverUrl && (
        <CoverImage
          src={coverUrl}
          alt=""
          fill
          sizes="58px"
          className={`object-cover transition-transform duration-300 group-hover:scale-[1.05] ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={onLoad}
        />
      )}
      <span className="absolute bottom-1 right-1 rounded-[5px] border border-white/15 bg-black/65 px-[5px] py-[2px] text-[9px] font-[700] leading-none tracking-[0.08em] text-white backdrop-blur-sm pointer-events-none select-none">
        {number}
      </span>
    </div>
  );
}

export default memo(DailyMixCover);
