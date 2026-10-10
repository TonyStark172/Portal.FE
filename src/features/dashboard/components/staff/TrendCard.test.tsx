import "@/app/globals.css";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { StaffTrendPointDto } from "@/shared/api/generated/portalApi";
import { startHeadcount, TrendCard } from "./TrendCard";

const trend: StaffTrendPointDto[] = [
  { from: "2026-08-01", to: "2026-08-31", joined: 5, left: 1, headcount: 96 },
  { from: "2026-09-01", to: "2026-09-30", joined: 3, left: 0, headcount: 99 },
  { from: "2026-10-01", to: "2026-10-31", joined: 2, left: 1, headcount: 100 },
  { from: "2026-11-01", to: "2026-11-30", joined: 0, left: 0, headcount: null },
];

function renderCard() {
  return render(
    <TrendCard trend={trend} period="Year" joined={10} left={2} from="2026-01-01" to="2026-12-31" />,
  );
}

describe("the staff trend card", () => {
  test("shows the complete area immediately when reduced motion is requested", async () => {
    const matchMedia = window.matchMedia.bind(window);
    const preference = vi.spyOn(window, "matchMedia").mockImplementation((query) => {
      const result = matchMedia(query);
      if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(result, "matches", { value: true });
      return result;
    });
    try {
      await renderCard();
      await vi.waitFor(() => expect(document.querySelector(".recharts-area-curve")).not.toBeNull());
      expect(document.querySelector(".recharts-area clipPath rect")).toBeNull();
    } finally {
      preference.mockRestore();
    }
  });

  test("progressively reveals the area when statistics arrive", async () => {
    const widths = new Set<number>();
    const observer = new MutationObserver(() => {
      const clip = document.querySelector(".recharts-area clipPath rect");
      if (clip) widths.add(Number(clip.getAttribute("width")));
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["width"] });
    try {
      await renderCard();
      await vi.waitFor(() => expect(widths.size).toBeGreaterThan(1));
    } finally {
      observer.disconnect();
    }
  });

  test("interpolates the area when the selected period changes", async () => {
    const screen = await renderCard();
    await vi.waitFor(() => expect(document.querySelector(".recharts-area-curve")).not.toBeNull());
    await new Promise(resolve => setTimeout(resolve, 900));
    const paths = new Set<string>();
    const observer = new MutationObserver(() => {
      const path = document.querySelector(".recharts-area-curve")?.getAttribute("d");
      if (path) paths.add(path);
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["d"] });
    try {
      await screen.rerender(<TrendCard trend={[
        { from: "2026-10-01", to: "2026-10-07", joined: 10, left: 0, headcount: 120 },
        { from: "2026-10-08", to: "2026-10-14", joined: 5, left: 0, headcount: 125 },
      ]} period="Month" joined={15} left={0} from="2026-10-01" to="2026-10-31" />);
      await vi.waitFor(() => expect(paths.size).toBeGreaterThan(2));
    } finally {
      observer.disconnect();
    }
  });

  test("sums up the period: joined, left and the net change", async () => {
    await renderCard();

    await vi.waitFor(() => expect(document.querySelector("[data-figure='joined']")?.textContent).toContain("+10"));
    expect(document.querySelector("[data-figure='left']")?.textContent).toContain("−2");
    expect(document.querySelector("[data-figure='net']")?.textContent).toContain("+8");
  });

  test("starts the line at the headcount when the period began, so it ends up by the net change", async () => {
    await renderCard();

    // 96 at the end of August, after 5 joined and 1 left in August: 92 when the period's chart begins.
    await vi.waitFor(() => expect(document.body.textContent).toContain("Đầu kỳ"));
    expect(startHeadcount(trend)).toBe(92);
    expect(trend.at(-2)!.headcount! - startHeadcount(trend)!).toBe(5 + 3 + 2 - 1 - 1);
  });

  test("draws the headcount over the period as an area", async () => {
    await renderCard();

    await vi.waitFor(() => expect(document.querySelector(".recharts-area-curve")).not.toBeNull());
    expect(document.body.textContent).toContain("Tổng nhân sự theo thời gian");
    // One tick per month of the period.
    expect(document.body.textContent).toContain("T8");
    expect(document.body.textContent).toContain("T10");
  });
});
