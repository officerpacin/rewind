import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { sidebarNavItems } from "@/features/navigation/data/navigation";
import { useTranslation } from "@/languages";
import { Tooltip } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { MUSIC_ONLY_MODE } from "@/shared/api/baseUrl";

export interface SidebarNavItemsProps {
  searchOpen: boolean;
  onSearchToggle: () => void;
}

export function SidebarNavItems({
  searchOpen,
  onSearchToggle,
}: SidebarNavItemsProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const isRouteActive = (href: string) => {
    if (pendingHref) return href === pendingHref;
    if (href === "/") {
      return pathname === "/" || pathname === "/home";
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  const isItemActive = (id: string, href?: string) => {
    if (id === "search") {
      return searchOpen;
    }
    return href ? isRouteActive(href) : false;
  };

  return (
    <>
      {sidebarNavItems
        .filter(
          (item) =>
            item.id !== "settings" &&
            !(MUSIC_ONLY_MODE && ["library", "stats"].includes(item.id)),
        )
        .map((item) => {
          const active = isItemActive(item.id, item.href);
          const Icon = item.Icon;
          const tooltipLabel = t(`common.sidebar.${item.id}`) || item.label;

          if (item.id === "search") {
            return (
              <Tooltip
                key={item.id}
                content={tooltipLabel}
                side="right"
                sideOffset={12}
              >
                <button
                  type="button"
                  aria-pressed={searchOpen}
                  onClick={onSearchToggle}
                  className={cn(
                    "group relative inline-flex h-10 w-full items-center justify-start gap-3 rounded-xl border-0 px-3 cursor-pointer transition-all duration-150 active:scale-[0.98] max-[760px]:w-10 max-[760px]:justify-center max-[760px]:px-0",
                    active
                      ? "bg-btn-primary-bg text-btn-primary-text shadow-[0_5px_18px_color-mix(in_srgb,var(--accent-primary)_18%,transparent)]"
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

          return (
            <Tooltip
              key={item.id}
              content={tooltipLabel}
              side="right"
              sideOffset={12}
            >
              <Link
                key={item.id}
                to={item.href!}
                aria-current={active ? "page" : undefined}
                onPointerDown={(event) => {
                  if (event.button === 0) setPendingHref(item.href!);
                }}
                onPointerLeave={(event) => {
                  if (event.buttons & 1) setPendingHref(null);
                }}
                onPointerCancel={() => setPendingHref(null)}
                className={cn(
                  "group relative inline-flex h-10 w-full items-center justify-start gap-3 rounded-xl px-3 cursor-pointer transition-all duration-150 active:scale-[0.98] max-[760px]:w-10 max-[760px]:justify-center max-[760px]:px-0",
                  active
                    ? "bg-btn-primary-bg text-btn-primary-text shadow-[0_5px_18px_color-mix(in_srgb,var(--accent-primary)_18%,transparent)]"
                    : "text-text-secondary hover:bg-bg-elevated hover:text-text-primary",
                )}
              >
                <Icon size={20} className="relative z-10 shrink-0" />
                <span className="text-[13px] font-[550] max-[760px]:hidden">
                  {tooltipLabel}
                </span>
              </Link>
            </Tooltip>
          );
        })}
    </>
  );
}
