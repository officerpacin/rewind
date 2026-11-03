import { memo, useState } from "react";
import { ScrollableText } from "@/shared/ui";
import DropdownMenu from "@/shared/ui/DropdownMenu";
import type { DailyMix } from "../hooks/useDailyMixes";
import { useDailyMixActions } from "../hooks/useDailyMixActions";
import DailyMixCover from "./DailyMixCover";
import { PlayFill } from "@mingcute/react";

export interface DailyMixCardProps {
  mix: DailyMix;
  index?: number;
}

function DailyMixCard({ mix, index }: DailyMixCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const {
    menuItems,
    menuOpen,
    setMenuOpen,
    menuPosition,
    setMenuPosition,
    handleContextMenu,
    handleClick,
  } = useDailyMixActions(mix);

  const subtitleText =
    (mix.clusterArtists && mix.clusterArtists.length > 0
      ? mix.clusterArtists.join(", ")
      : mix.description) || "";

  const mixNumber = mix.title.match(/\d+/)?.[0] ?? String((index ?? 0) + 1);

  return (
    <div
      className="group flex min-w-0 items-center gap-3 rounded-[16px] border border-border-alpha-14 bg-bg-surface/75 p-2.5 cursor-pointer select-none transition-colors hover:bg-bg-elevated"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => setIsCardHovered(false)}
    >
      <DailyMixCover
        coverUrl={mix.coverUrl}
        mixNumber={mixNumber}
        imageLoaded={imageLoaded}
        onLoad={() => setImageLoaded(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[13px] font-[600] text-text-primary">
          {mix.title}
        </span>
        <ScrollableText
          text={subtitleText}
          isParentHovered={isCardHovered}
          className="text-[11px] text-text-tertiary"
          fadeColorClass="from-bg-primary"
        />
      </div>
      <PlayFill className="mr-1 h-4 w-4 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />

      {menuItems.length > 0 && (
        <DropdownMenu
          trigger={<span />}
          items={menuItems}
          open={menuOpen}
          onOpenChange={(isOpen) => {
            setMenuOpen(isOpen);
            if (!isOpen) setMenuPosition(null);
          }}
          position={menuPosition}
        />
      )}
    </div>
  );
}

export default memo(DailyMixCard);
