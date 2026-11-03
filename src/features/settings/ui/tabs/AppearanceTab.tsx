import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useTranslation, LOCALE_OPTIONS } from "@/languages";
import { MenuSelect, useToast } from "@/shared/ui";
import { revealThemeChange } from "@/shared/lib";
import { useAppearanceStore } from "../../store/appearanceStore";
import { SettingBlock, SettingRow, SettingSection } from "../controls";
import { ThemeCard } from "./ThemeCard";

const ACCENT_PRESETS = [
  { label: "default", value: null, swatch: null },
  { label: "blue", value: "#4b8ff7", swatch: "#4b8ff7" },
  { label: "violet", value: "#9674ed", swatch: "#9674ed" },
  { label: "rose", value: "#e87598", swatch: "#e87598" },
  { label: "amber", value: "#e39a46", swatch: "#e39a46" },
] as const;

const BACKGROUND_PRESETS = [
  {
    value: "default",
    label: "default",
    preview: "linear-gradient(135deg, #777, #222)",
  },
  {
    value: "midnight",
    label: "midnight",
    preview: "linear-gradient(135deg, #66628f, #171720 70%)",
  },
  {
    value: "ocean",
    label: "ocean",
    preview: "linear-gradient(135deg, #4f87ad, #151c25 70%)",
  },
  {
    value: "sunset",
    label: "sunset",
    preview: "linear-gradient(135deg, #b97868, #211918 70%)",
  },
] as const;

export function AppearanceTab({ searchQuery }: { searchQuery?: string }) {
  const { t, locale, setLocale } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { toast } = useToast();
  const accentColor = useAppearanceStore((state) => state.accentColor);
  const background = useAppearanceStore((state) => state.background);
  const customBackground = useAppearanceStore(
    (state) => state.customBackground,
  );
  const setAccentColor = useAppearanceStore((state) => state.setAccentColor);
  const setBackground = useAppearanceStore((state) => state.setBackground);
  const setCustomBackground = useAppearanceStore(
    (state) => state.setCustomBackground,
  );
  const resetAppearance = useAppearanceStore((state) => state.resetAppearance);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleBackgroundUpload = (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
        file.type,
      )
    ) {
      toast(t("settings.appearance.invalid_image"), "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast(t("settings.appearance.image_too_large"), "error");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () =>
      toast(t("settings.appearance.image_read_failed"), "error");
    reader.onload = () => {
      if (
        typeof reader.result !== "string" ||
        !setCustomBackground(reader.result)
      ) {
        toast(t("settings.appearance.save_failed"), "error");
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <SettingSection>
      <SettingRow
        title={t("settings.language.label")}
        description={t("settings.language.description")}
        titleKey="settings.language.label"
        descKey="settings.language.description"
        searchQuery={searchQuery}
        control={
          mounted ? (
            <MenuSelect
              options={LOCALE_OPTIONS}
              value={locale}
              onChange={setLocale}
              className="min-w-[130px]"
              aria-label={t("settings.language.label")}
            />
          ) : (
            <span />
          )
        }
      />

      <SettingBlock
        title={t("settings.theme.title")}
        description={t("settings.theme.description")}
        titleKey="settings.theme.title"
        descKey="settings.theme.description"
        searchQuery={searchQuery}
      >
        {mounted ? (
          <div className="grid grid-cols-3 gap-[10px]">
            {(
              [
                { value: "system", label: t("settings.theme.system") },
                { value: "light", label: t("settings.theme.light") },
                { value: "dark", label: t("settings.theme.dark") },
              ] as const
            ).map((item) => {
              return (
                <ThemeCard
                  key={item.value}
                  mode={item.value}
                  label={item.label}
                  active={theme === item.value}
                  onSelect={(event) =>
                    revealThemeChange(() => setTheme(item.value), {
                      x: event.clientX,
                      y: event.clientY,
                    })
                  }
                />
              );
            })}
          </div>
        ) : null}
      </SettingBlock>

      <SettingBlock
        title={t("settings.appearance.accent_title")}
        description={t("settings.appearance.accent_description")}
        titleKey="settings.appearance.accent_title"
        descKey="settings.appearance.accent_description"
        searchQuery={searchQuery}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          {ACCENT_PRESETS.map((preset) => {
            const active = accentColor === preset.value;
            return (
              <button
                key={preset.label}
                type="button"
                aria-label={t(`settings.appearance.colors.${preset.label}`)}
                aria-pressed={active}
                title={t(`settings.appearance.colors.${preset.label}`)}
                onClick={() => {
                  if (!setAccentColor(preset.value)) {
                    toast(t("settings.appearance.save_failed"), "error");
                  }
                }}
                className={`h-8 w-8 rounded-full border border-border-secondary transition-transform hover:scale-110 ${
                  active
                    ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-primary"
                    : ""
                }`}
                style={{
                  backgroundColor:
                    preset.swatch ??
                    (resolvedTheme === "light" ? "#19191b" : "#f1f1f2"),
                }}
              />
            );
          })}
          <label
            title={t("settings.appearance.custom_color")}
            className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border-secondary bg-[conic-gradient(#ed6a5e,#f4c95d,#5bc68b,#5d9cec,#aa73dc,#ed6a5e)]"
          >
            <input
              type="color"
              aria-label={t("settings.appearance.custom_color")}
              value={
                accentColor ??
                (resolvedTheme === "light" ? "#19191b" : "#f1f1f2")
              }
              onChange={(event) => {
                if (!setAccentColor(event.currentTarget.value)) {
                  toast(t("settings.appearance.save_failed"), "error");
                }
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!resetAppearance()) {
                toast(t("settings.appearance.save_failed"), "error");
              }
            }}
            className="ml-auto rounded-lg bg-bg-elevated px-3 py-1.5 text-[12px] text-text-secondary transition-colors hover:text-text-primary"
          >
            {t("settings.appearance.reset")}
          </button>
        </div>
      </SettingBlock>

      <SettingBlock
        title={t("settings.appearance.background_title")}
        description={t("settings.appearance.background_description")}
        titleKey="settings.appearance.background_title"
        descKey="settings.appearance.background_description"
        searchQuery={searchQuery}
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {BACKGROUND_PRESETS.map((preset) => {
            const active = background === preset.value;
            return (
              <button
                key={preset.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (!setBackground(preset.value)) {
                    toast(t("settings.appearance.save_failed"), "error");
                  }
                }}
                className={`overflow-hidden rounded-[10px] border bg-transparent p-1 text-left transition-colors ${
                  active
                    ? "border-accent-primary ring-1 ring-accent-primary"
                    : "border-border-primary hover:border-border-tertiary"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="block h-[46px] rounded-[6px]"
                  style={{ background: preset.preview }}
                />
                <span className="mt-1.5 block truncate px-1 text-[11px] text-text-secondary">
                  {t(`settings.appearance.backgrounds.${preset.label}`)}
                </span>
              </button>
            );
          })}
          {customBackground && (
            <button
              type="button"
              aria-pressed={background === "custom"}
              onClick={() => {
                if (!setBackground("custom")) {
                  toast(t("settings.appearance.save_failed"), "error");
                }
              }}
              className={`overflow-hidden rounded-[10px] border bg-transparent p-1 text-left transition-colors ${
                background === "custom"
                  ? "border-accent-primary ring-1 ring-accent-primary"
                  : "border-border-primary hover:border-border-tertiary"
              }`}
            >
              <span
                aria-hidden="true"
                className="block h-[46px] rounded-[6px] bg-cover bg-center"
                style={{ backgroundImage: `url("${customBackground}")` }}
              />
              <span className="mt-1.5 block truncate px-1 text-[11px] text-text-secondary">
                {t("settings.appearance.custom_background")}
              </span>
            </button>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-bg-elevated px-3 py-2 text-[12px] font-medium text-text-primary transition-colors hover:bg-bg-panel">
            {t("settings.appearance.choose_image")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              aria-label={t("settings.appearance.choose_image")}
              onChange={(event) => {
                handleBackgroundUpload(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
              className="sr-only"
            />
          </label>
        </div>
      </SettingBlock>
    </SettingSection>
  );
}
