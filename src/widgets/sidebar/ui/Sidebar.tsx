import { memo } from "react";
import { SidebarNavItems } from "./SidebarNavItems";
import { SidebarSettingsButton } from "./SidebarSettingsButton";
import { cn } from "@/shared/lib";

export interface SidebarProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
}

function Sidebar({ searchOpen, onSearchToggle }: SidebarProps) {
  return (
    <div
      className={cn(
        "h-full w-full rounded-[20px] flex flex-col overflow-hidden border border-border-alpha-14 bg-bg-surface/90 backdrop-blur-xl shadow-[0_18px_48px_rgba(0,0,0,0.2)] max-[760px]:rounded-xl max-[760px]:px-0",
      )}
    >
      <nav className="relative flex-1 flex flex-col items-stretch gap-1.5 pt-5 px-3 max-[760px]:px-1 max-[760px]:items-center">
        <SidebarNavItems
          searchOpen={searchOpen}
          onSearchToggle={onSearchToggle}
        />
      </nav>

      <div className="mx-3 mb-3 border-t border-border-alpha-14 pt-3 shrink-0 flex flex-col items-stretch max-[760px]:mx-1 max-[760px]:items-center">
        <SidebarSettingsButton />
      </div>
    </div>
  );
}

export default memo(Sidebar);
