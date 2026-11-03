import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { NotificationDto } from "@/shared/api/generated/portalApi";
import { backgroundOn, colorOn, inEveryTheme, MIN_SHAPE_CONTRAST, MIN_TEXT_CONTRAST, contrast, over, resetTheme, toRgba } from "../lib/contrast.testing";
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

describe("a notification row", () => {
  afterEach(resetTheme);

  test("an unread row's text and dot stay readable on its tint in light, dark and every colour theme", async () => {
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
    const dot = row.querySelector("span[aria-hidden][class~='rounded-full'][class~='size-2.5']")!;
    expect(dot).not.toBeNull();

    const tooFaint: string[] = [];
    inEveryTheme((label) => {
      // A translucent panel (the glass theme) shows the page through it.
      const behind = backgroundOn(panel, backgroundOn(page, [255, 255, 255, 1]));
      const background = backgroundOn(row, behind);
      for (const [name, element] of [["excerpt", excerpt], ["time", time]] as const) {
        const ratio = contrast(colorOn(element, background), background);
        if (ratio < MIN_TEXT_CONTRAST) tooFaint.push(`${label} ${name} ${ratio.toFixed(2)}`);
      }
      const dotRatio = contrast(backgroundOn(dot, background), background);
      if (dotRatio < MIN_SHAPE_CONTRAST) tooFaint.push(`${label} dot ${dotRatio.toFixed(2)}`);
      // The tint is grey, not the theme's colour: it adds no more hue than the panel behind it has.
      const hue = ([r, g, b]: number[]) => Math.max(r, g, b) - Math.min(r, g, b);
      if (hue(background) > hue(behind) + 6) tooFaint.push(`${label} tint has a hue (${background.slice(0, 3).map(Math.round)})`);
    });

    expect(tooFaint).toEqual([]);
  });

  test("the contrast helper refuses a colour it cannot read, instead of measuring the previous one", () => {
    expect(() => toRgba("not a colour")).toThrow("not a colour");
    expect(toRgba("rgb(255 0 0)")).toEqual([255, 0, 0, 1]);
    const half = over(toRgba("rgb(0 0 0 / 0.5)"), [255, 255, 255, 1]);
    expect(Math.abs(half[0] - 127.5)).toBeLessThan(1.5);
  });
});
