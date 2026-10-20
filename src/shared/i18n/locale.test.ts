import { describe, expect, it, beforeEach } from "vitest";
import { DEFAULT_LOCALE, getStoredLocale, setStoredLocale, translate } from "./locale";

describe("locale utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to Vietnamese when no locale has been stored", () => {
    expect(getStoredLocale()).toBe(DEFAULT_LOCALE);
  });

  it("persists a supported locale and translates shared keys", () => {
    setStoredLocale("en-US");

    expect(getStoredLocale()).toBe("en-US");
    expect(translate("common.hello", "en-US")).toBe("Hello");
  });

  it("falls back to Vietnamese when a key is missing", () => {
    expect(translate("missing.key", "en-US")).toBe("missing.key");
    expect(translate("common.hello", "unsupported")).toBe("Xin chào");
  });
});
