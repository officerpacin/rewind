import { create } from "zustand";

export type AppBackground =
  "default" | "midnight" | "ocean" | "sunset" | "custom";

interface AppearanceSettings {
  accentColor: string | null;
  background: AppBackground;
  customBackground: string | null;
}

interface AppearanceState extends AppearanceSettings {
  setAccentColor: (color: string | null) => boolean;
  setBackground: (background: AppBackground) => boolean;
  setCustomBackground: (background: string) => boolean;
  resetAppearance: () => boolean;
}

const STORAGE_KEY = "rewind-appearance-settings";
const DEFAULT_SETTINGS: AppearanceSettings = {
  accentColor: null,
  background: "default",
  customBackground: null,
};

function isAppBackground(value: unknown): value is AppBackground {
  return (
    value === "default" ||
    value === "midnight" ||
    value === "ocean" ||
    value === "sunset" ||
    value === "custom"
  );
}

function loadAppearanceSettings(): AppearanceSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_SETTINGS;

    const settings = parsed as Record<string, unknown>;
    const accentColor =
      typeof settings.accentColor === "string" &&
      /^#[\da-f]{6}$/i.test(settings.accentColor)
        ? settings.accentColor
        : null;
    const customBackground =
      typeof settings.customBackground === "string" &&
      /^data:image\/(?:jpeg|png|webp|avif);base64,/i.test(
        settings.customBackground,
      )
        ? settings.customBackground
        : null;
    const background = isAppBackground(settings.background)
      ? settings.background
      : "default";

    return {
      accentColor,
      background:
        background === "custom" && !customBackground ? "default" : background,
      customBackground,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveAppearanceSettings(settings: AppearanceSettings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

const initialSettings = loadAppearanceSettings();

export const useAppearanceStore = create<AppearanceState>((set, get) => ({
  ...initialSettings,
  setAccentColor: (accentColor) => {
    if (accentColor !== null && !/^#[\da-f]{6}$/i.test(accentColor)) {
      return false;
    }

    const current = get();
    const settings = {
      accentColor,
      background: current.background,
      customBackground: current.customBackground,
    };
    if (!saveAppearanceSettings(settings)) return false;
    set({ accentColor });
    return true;
  },
  setBackground: (background) => {
    const current = get();
    if (background === "custom" && !current.customBackground) return false;
    const settings = {
      accentColor: current.accentColor,
      background,
      customBackground: current.customBackground,
    };
    if (!saveAppearanceSettings(settings)) return false;
    set({ background });
    return true;
  },
  setCustomBackground: (customBackground) => {
    if (
      !/^data:image\/(?:jpeg|png|webp|avif);base64,/i.test(customBackground)
    ) {
      return false;
    }

    const current = get();
    const settings = {
      accentColor: current.accentColor,
      background: "custom" as const,
      customBackground,
    };
    if (!saveAppearanceSettings(settings)) return false;
    set({ background: "custom", customBackground });
    return true;
  },
  resetAppearance: () => {
    if (!saveAppearanceSettings(DEFAULT_SETTINGS)) return false;
    set(DEFAULT_SETTINGS);
    return true;
  },
}));
