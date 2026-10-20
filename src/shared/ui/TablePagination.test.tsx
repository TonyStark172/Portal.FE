import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { TablePagination } from "./TablePagination";

const info = { pageNumber: 1, totalPages: 3, totalCount: 25, hasPreviousPage: false, hasNextPage: true };
afterEach(async () => { await page.viewport(1000, 800); });

test("shows the summary and moves to a chosen page", async () => {
  const onPageChange = vi.fn();
  const screen = await render(<TablePagination page={info} summary="1–10 trên 25" onPageChange={onPageChange} />);
  await expect.element(screen.getByText("1–10 trên 25")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Trước" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "2" }));
  expect(onPageChange).toHaveBeenCalledWith(2);
});

test("on a phone, a page of pages between two arrows", async () => {
  await page.viewport(390, 844);
  const onPageChange = vi.fn();
  const screen = await render(<TablePagination page={info} summary="1–10 trên 25" onPageChange={onPageChange} />);
  await expect.element(screen.getByText("1/3")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Sau" }));
  expect(onPageChange).toHaveBeenCalledWith(2);
});
