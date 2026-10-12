import { afterEach, expect, test } from "vitest";
import { renderHook } from "vitest-browser-react";
import { page } from "vitest/browser";
import { useBreakpoint, useOrientation } from "./breakpoints";
import { usePhone } from "./usePhone";

afterEach(async () => { await page.viewport(1000, 800); });

test.each([
  [390, 844, "phone", "portrait"],
  [320, 640, "phone", "portrait"],
  [767, 1000, "phone", "portrait"],
  // A phone turned sideways is short: still a phone.
  [844, 390, "phone", "landscape"],
  [932, 430, "phone", "landscape"],
  [768, 1000, "tablet", "portrait"],
  [900, 1000, "tablet", "portrait"],
  // A tablet turned sideways stays a tablet.
  [1024, 768, "tablet", "landscape"],
  [1025, 768, "desktop", "landscape"],
  [1280, 800, "desktop", "landscape"],
  // A wide but short window is not a phone.
  [1280, 400, "desktop", "landscape"],
] as const)("at %ix%i the screen is a %s in %s", async (width, height, size, orientation) => {
  await page.viewport(width, height);
  const { result } = await renderHook(() => ({ size: useBreakpoint(), orientation: useOrientation(), phone: usePhone() }));
  expect(result.current).toEqual({ size, orientation, phone: size === "phone" });
});

test("the screen size follows the window", async () => {
  await page.viewport(390, 844);
  const { result } = await renderHook(() => useBreakpoint());
  expect(result.current).toBe("phone");
  await page.viewport(1280, 800);
  await expect.poll(() => result.current).toBe("desktop");
  await page.viewport(844, 390);
  await expect.poll(() => result.current).toBe("phone");
});
