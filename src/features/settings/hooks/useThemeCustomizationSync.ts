import { useEffect } from "react";
import {
  useEffectiveCoverGlow,
  useIsDarkTheme,
} from "../store/customizationStore";
import { useAppearanceStore } from "../store/appearanceStore";

export function useThemeCustomizationSync() {
  const coverGlow = useEffectiveCoverGlow();
  const isDark = useIsDarkTheme();
  const accentColor = useAppearanceStore((state) => state.accentColor);
  const background = useAppearanceStore((state) => state.background);
  const customBackground = useAppearanceStore(
    (state) => state.customBackground,
  );

  useEffect(() => {
    document.documentElement.dataset.coverGlow = coverGlow ? "on" : "off";
  }, [coverGlow]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.appBackground = background;

    if (customBackground) {
      root.style.setProperty(
        "--app-custom-background",
        `url("${customBackground}")`,
      );
    } else {
      root.style.removeProperty("--app-custom-background");
    }
  }, [background, customBackground]);

  useEffect(() => {
    const root = document.documentElement;
    if (!accentColor) {
      root.style.removeProperty("--accent-primary");
      root.style.removeProperty("--accent-secondary");
      root.style.removeProperty("--accent-tertiary");
      root.style.removeProperty("--btn-primary-bg");
      root.style.removeProperty("--btn-primary-text");
      return;
    }

    const channels = accentColor
      .slice(1)
      .match(/.{2}/g)
      ?.map((channel) => Number.parseInt(channel, 16) / 255);
    if (!channels || channels.length !== 3) return;

    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const mixColor = isDark ? "white" : "black";

    root.style.setProperty("--accent-primary", accentColor);
    root.style.setProperty(
      "--accent-secondary",
      `color-mix(in srgb, ${accentColor} 76%, ${mixColor})`,
    );
    root.style.setProperty(
      "--accent-tertiary",
      `color-mix(in srgb, ${accentColor} 54%, ${mixColor})`,
    );
    root.style.setProperty("--btn-primary-bg", accentColor);
    root.style.setProperty(
      "--btn-primary-text",
      luminance > 0.179 ? "#18181a" : "#ffffff",
    );
  }, [accentColor, isDark]);
}
