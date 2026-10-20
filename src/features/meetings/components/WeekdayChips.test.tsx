import "@/app/globals.css";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import type { Weekday } from "../meetingTypes";
import { WeekdayChips } from "./WeekdayChips";

function Harness({ onChange, disabled }: { onChange: (days: Weekday[]) => void; disabled?: boolean }) {
  const [value, setValue] = useState<Weekday[]>(["Monday"]);
  return <WeekdayChips label="Thứ lặp lại" value={value} disabled={disabled} onChange={days => { setValue(days); onChange(days); }} />;
}

test("weekday chips output the selected days Monday-first regardless of click order", async () => {
  const onChange = vi.fn();
  const screen = await render(<Harness onChange={onChange} />);
  await userEvent.click(screen.getByRole("button", { name: "T4" }));
  await userEvent.click(screen.getByRole("button", { name: "T3" }));
  expect(onChange).toHaveBeenLastCalledWith(["Monday", "Tuesday", "Wednesday"]);
});

test("weekday chips reflect the value through aria-pressed and the group label", async () => {
  const screen = await render(<Harness onChange={vi.fn()} />);
  await expect.element(screen.getByRole("group", { name: "Thứ lặp lại" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "T2" })).toHaveAttribute("aria-pressed", "true");
  await expect.element(screen.getByRole("button", { name: "T3" })).toHaveAttribute("aria-pressed", "false");
});

test("disabled weekday chips do nothing when pressed", async () => {
  const onChange = vi.fn();
  const screen = await render(<Harness onChange={onChange} disabled />);
  const wednesday = screen.getByRole("button", { name: "T4" });
  await expect.element(wednesday).toBeDisabled();
  wednesday.element().dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(onChange).not.toHaveBeenCalled();
});
