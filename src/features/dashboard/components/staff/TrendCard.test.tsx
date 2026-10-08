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
