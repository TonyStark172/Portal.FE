import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { Occasion } from "../eventTypes";
import { OccasionCard } from "./OccasionCard";

const birthday: Occasion = { kind: "Birthday", date: "2026-10-14", userId: 9, fullName: "Lê Bình", avatarUrl: null, departmentName: "Kỹ thuật" };

afterEach(() => vi.restoreAllMocks());

test("a birthday shows who, their department and the day, never the year of birth", async () => {
  const screen = await render(<Provider store={makeStore()}><OccasionCard occasion={birthday} onClose={vi.fn()} /></Provider>);
  const dialog = screen.getByRole("dialog", { name: "Lê Bình" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText("Sinh nhật", { exact: true })).toBeVisible();
  await expect.element(dialog.getByText("Kỹ thuật")).toBeVisible();
  await expect.element(dialog.getByText(/14\/10/)).toBeVisible();
  // The avatar falls back to the initial of the given name.
  await expect.element(dialog.getByText("B", { exact: true })).toBeVisible();
});

test("a holiday shows its name, its days and that it is a public holiday", async () => {
  const screen = await render(<Provider store={makeStore()}>
    <OccasionCard occasion={{ kind: "Holiday", date: "2026-02-16", endDate: "2026-02-20", holiday: "LunarNewYear" }} onClose={vi.fn()} />
  </Provider>);
  const dialog = screen.getByRole("dialog", { name: "Tết Nguyên đán" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText("Ngày nghỉ lễ", { exact: true })).toBeVisible();
  await expect.element(dialog.getByText(/16\/02.*–.*20\/02/)).toBeVisible();
  expect(dialog.element().querySelector(".occasion-holiday")).not.toBeNull();
});

test("a one-day holiday shows its one day", async () => {
  const screen = await render(<Provider store={makeStore()}>
    <OccasionCard occasion={{ kind: "Holiday", date: "2026-09-02", endDate: "2026-09-02", holiday: "NationalDay" }} onClose={vi.fn()} />
  </Provider>);
  const dialog = screen.getByRole("dialog", { name: "Quốc khánh" });
  await expect.element(dialog.getByText(/02\/09/)).toBeVisible();
  expect(dialog.element().textContent).not.toContain("–");
});

test("the company's birthday shows the company, the year it was founded and how many years", async () => {
  const screen = await render(<Provider store={makeStore()}>
    <OccasionCard occasion={{ kind: "CompanyAnniversary", date: "2026-10-14", years: 5, organizationName: "Công ty AnNV" }} onClose={vi.fn()} />
  </Provider>);
  const dialog = screen.getByRole("dialog", { name: "Công ty AnNV" });
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByText("Sinh nhật 5 năm", { exact: true })).toBeVisible();
  await expect.element(dialog.getByText("Thành lập năm 2021", { exact: true })).toBeVisible();
  await expect.element(dialog.getByText(/14\/10/)).toBeVisible();
});
