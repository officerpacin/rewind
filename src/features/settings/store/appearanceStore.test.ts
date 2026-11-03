import { beforeEach, describe, expect, it } from "vitest";
import { useAppearanceStore } from "./appearanceStore";

describe("appearanceStore", () => {
  beforeEach(() => {
    localStorage.clear();
    useAppearanceStore.setState({
      accentColor: null,
      background: "default",
      customBackground: null,
    });
  });

  it("persists accent and background selections", () => {
    expect(useAppearanceStore.getState().setAccentColor("#4b8ff7")).toBe(true);
    expect(useAppearanceStore.getState().setBackground("ocean")).toBe(true);

    expect(
      JSON.parse(localStorage.getItem("rewind-appearance-settings")!),
    ).toEqual({
      accentColor: "#4b8ff7",
      background: "ocean",
      customBackground: null,
    });
  });

  it("rejects invalid colors and unsupported image formats", () => {
    expect(useAppearanceStore.getState().setAccentColor("green")).toBe(false);
    expect(useAppearanceStore.getState().setBackground("custom")).toBe(false);
    expect(
      useAppearanceStore
        .getState()
        .setCustomBackground("data:image/svg+xml;base64,PHN2Zz4="),
    ).toBe(false);
    expect(useAppearanceStore.getState().accentColor).toBeNull();
    expect(useAppearanceStore.getState().background).toBe("default");
  });

  it("saves a custom image and resets appearance settings", () => {
    expect(
      useAppearanceStore
        .getState()
        .setCustomBackground("data:image/png;base64,aGVsbG8="),
    ).toBe(true);
    expect(useAppearanceStore.getState().background).toBe("custom");
    expect(useAppearanceStore.getState().setBackground("ocean")).toBe(true);
    expect(useAppearanceStore.getState().setBackground("custom")).toBe(true);
    expect(useAppearanceStore.getState().background).toBe("custom");

    expect(useAppearanceStore.getState().resetAppearance()).toBe(true);
    expect(useAppearanceStore.getState().background).toBe("default");
    expect(useAppearanceStore.getState().customBackground).toBeNull();
  });
});
