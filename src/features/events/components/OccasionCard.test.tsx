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

test("a work anniversary says how many years", async () => {
  const screen = await render(<Provider store={makeStore()}>
    <OccasionCard occasion={{ ...birthday, kind: "WorkAnniversary", years: 3, departmentName: null }} onClose={vi.fn()} />
  </Provider>);
  await expect.element(screen.getByText("Kỷ niệm 3 năm làm việc")).toBeVisible();
});
