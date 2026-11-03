import { sidebarNavItems } from "@/features/navigation/data/navigation";
import { useTranslation } from "@/languages";
import { useModalStore } from "@/features/library";
import { Tooltip } from "@/shared/ui";
import { cn } from "@/shared/lib";

export function SidebarSettingsButton() {
  const { t } = useTranslation();
  const settingsOpen = useModalStore((state) => state.settingsOpen);
  const toggleSettings = useModalStore((state) => state.toggleSettings);

  const settingsItem = sidebarNavItems.find((item) => item.id === "settings");
  if (!settingsItem) return null;

  const Icon = settingsItem.Icon;
  const tooltipLabel = t("common.sidebar.settings") || settingsItem.label;

  return (
    <Tooltip content={tooltipLabel} side="right" sideOffset={12}>
      <button
        type="button"
        aria-pressed={settingsOpen}
        onClick={toggleSettings}
        className={cn(
          "group relative inline-flex h-10 w-full items-center justify-start gap-3 rounded-xl px-3 border-0 cursor-pointer transition-all duration-150 active:scale-[0.98] max-[760px]:w-10 max-[760px]:justify-center max-[760px]:px-0",
          settingsOpen
            ? "bg-btn-primary-bg text-btn-primary-text"
            : "bg-transparent text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
        )}
      >
        <Icon size={20} className="relative z-10 shrink-0" />
        <span className="text-[13px] font-[550] max-[760px]:hidden">
          {tooltipLabel}
        </span>
      </button>
    </Tooltip>
  );
}
