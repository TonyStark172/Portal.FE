import "@/app/globals.css";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { GenderCard } from "./GenderCard";

const row = (key: string) =>
  [...document.querySelectorAll<HTMLElement>("[data-gender-row]")].find((r) => r.dataset.genderRow === key);

describe("the gender card", () => {
  test("shows men and women only, with their count, share and a bar", async () => {
    await render(<GenderCard stats={{ male: 1200, female: 800, unspecified: 500, total: 2500 }} />);

    await vi.waitFor(() => expect(row("male")?.textContent).toContain("1.200"));
    expect(row("male")?.textContent).toContain("Nam");
    expect(row("male")?.textContent).toContain("60%");
    expect(row("female")?.textContent).toContain("40%");
    expect(document.querySelectorAll("[data-gender-row]").length).toBe(2);
    expect(row("male")?.querySelector<HTMLElement>("[data-bar]")?.style.width).toBe("60%");
    // The middle of the donut counts those who gave their gender.
    expect(document.querySelector("[data-donut-total]")?.textContent).toContain("2.000");
    await vi.waitFor(() => expect(document.querySelectorAll(".recharts-pie-sector").length).toBe(2));
  });

  test("tells how many have not filled in their gender", async () => {
    await render(<GenderCard stats={{ male: 1, female: 1, unspecified: 500, total: 502 }} />);

    await vi.waitFor(() => expect(document.body.textContent).toContain("500 nhân sự chưa cập nhật giới tính"));
    expect(document.body.textContent).not.toContain("Không nêu");
    expect(document.body.textContent).not.toContain("Khác");
  });

  test("says so instead of drawing an empty donut when nobody gave their gender", async () => {
    await render(<GenderCard stats={{ male: 0, female: 0, unspecified: 7, total: 7 }} />);

    await vi.waitFor(() => expect(document.body.textContent).toContain("Chưa có nhân sự nào cập nhật giới tính."));
    expect(document.querySelector(".recharts-pie")).toBeNull();
  });
});
