import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { COLOR_THEMES } from "@/shared/theme/theme";
import type { NotificationDto } from "@/shared/api/generated/portalApi";
import { NotificationRow } from "./NotificationRow";

const item = (changes: Partial<NotificationDto> = {}): NotificationDto => ({
  id: 1,
  kind: "PostComment",
  actor: { id: 7, fullName: "Lê Hà", avatarUrl: null },
  actorCount: 1,
  postId: 10,
  commentId: null,
  meetingId: null,
  excerpt: "Bình luận số 1",
  meetingStartUtc: null,
  occurredAt: new Date().toISOString(),
  isRead: false,
  ...changes,
});

type Rgba = [number, number, number, number];

/** A 1×1 canvas resolves any CSS colour (oklch, lab, color-mix…) to sRGB bytes, with its alpha. */
function toRgba(color: string): Rgba {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b, a / 255];
}

const over = ([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];

function luminance([r, g, b]: Rgba) {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const contrast = (a: Rgba, b: Rgba) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);

/** WCAG AA for text this small. */
const MIN_TEXT_CONTRAST = 4.5;

describe("a notification row", () => {
  afterEach(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    delete root.dataset.theme;
    delete root.dataset.colorTheme;
  });

  test("an unread row's excerpt and time stay readable on its tint in light, dark and every colour theme", async () => {
    const screen = await render(
      <Provider store={makeStore()}>
        <div data-testid="page" className="bg-background">
          <div data-testid="panel" className="bg-overlay">
            <ul>
              <NotificationRow item={item()} onOpen={() => {}} />
            </ul>
          </div>
        </div>
      </Provider>,
    );
    const page = screen.container.querySelector<HTMLElement>("[data-testid=page]")!;
    const panel = screen.container.querySelector<HTMLElement>("[data-testid=panel]")!;
    const row = panel.querySelector("li")!;
    const excerpt = [...row.querySelectorAll("span")].find((span) => span.textContent === "Bình luận số 1")!;
    const time = row.querySelector("time")!;
    const root = document.documentElement;

    const tooFaint: string[] = [];
    for (const dark of [false, true]) {
      for (const theme of COLOR_THEMES) {
        root.classList.toggle("dark", dark);
        root.dataset.theme = dark ? "dark" : "light";
        if (theme === "default") delete root.dataset.colorTheme;
        else root.dataset.colorTheme = theme;

        // A translucent panel (the glass theme) shows the page through it.
        const behind = over(toRgba(getComputedStyle(panel).backgroundColor), over(toRgba(getComputedStyle(page).backgroundColor), [255, 255, 255, 1]));
        const background = over(toRgba(getComputedStyle(row).backgroundColor), behind);
        for (const [name, element] of [["excerpt", excerpt], ["time", time]] as const) {
          const ratio = contrast(over(toRgba(getComputedStyle(element).color), background), background);
          if (ratio < MIN_TEXT_CONTRAST) tooFaint.push(`${dark ? "dark" : "light"}/${theme} ${name} ${ratio.toFixed(2)}`);
        }
      }
    }

    expect(tooFaint).toEqual([]);
  });
});
