import "@/app/globals.css";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { NumberStepper } from "./NumberStepper";

/** A stepper holding its own value, as a form would. */
function Level({ initial = 3, suffix }: { initial?: number; suffix?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      label="Cấp bậc"
      value={value}
      onChange={setValue}
      minValue={1}
      maxValue={5}
      suffix={suffix}
      decrementLabel="Giảm"
      incrementLabel="Tăng"
    />
  );
}

const shownValue = (container: HTMLElement) => container.querySelector("number-flow-react");

/** The box shadows that draw something (a ring or a shadow), leaving out the empty 0px layers Tailwind composes. */
const visibleShadows = (element: Element) =>
  getComputedStyle(element).boxShadow
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.trim())
    .filter((layer) => layer !== "none" && !/(^|\s)0px 0px 0px 0px$/.test(layer) && !layer.startsWith("rgba(0, 0, 0, 0)"));

test("the value is shown by the rolling number, never by the field itself", async () => {
  const screen = await render(<Level />);
  const input = screen.getByRole("textbox", { name: /^Cấp bậc/ });
  await expect.element(input).toHaveValue("3");
  // The field stays for forms and screen readers, but is clipped away.
  expect(getComputedStyle(input.element()).clipPath).toBe("inset(50%)");
  expect(shownValue(screen.container)).not.toBeNull();
});

test("− and + move one step, and stop at the bounds", async () => {
  const screen = await render(<Level initial={4} />);
  const input = screen.getByRole("textbox", { name: /^Cấp bậc/ });

  await userEvent.click(screen.getByRole("button", { name: "Tăng" }));
  await expect.element(input).toHaveValue("5");
  await expect.element(screen.getByRole("button", { name: "Tăng" })).toBeDisabled();

  await userEvent.click(screen.getByRole("button", { name: "Giảm" }));
  await expect.element(input).toHaveValue("4");
});

test("the rolling number stays on screen while the field has the focus", async () => {
  const screen = await render(<Level />);
  await userEvent.click(screen.getByRole("button", { name: "Tăng" }));
  (screen.getByRole("textbox", { name: /^Cấp bậc/ }).element() as HTMLInputElement).focus();
  await userEvent.keyboard("{ArrowUp}");
  await expect.element(screen.getByRole("textbox", { name: /^Cấp bậc/ })).toHaveValue("5");
  expect(shownValue(screen.container)).not.toBeNull();
});

test("the buttons are round, with a press that shrinks them slightly", async () => {
  const screen = await render(<Level />);
  const button = screen.getByRole("button", { name: "Tăng" }).element();
  const style = getComputedStyle(button);
  expect(style.width).toBe("32px");
  expect(style.height).toBe("32px");
  expect(style.transitionProperty).toContain("transform");
  expect(button.className).toContain("data-[pressed=true]:scale-[0.98]");
});

test("a ring shows around the stepper for the keyboard only, not after a click", async () => {
  const screen = await render(<Level />);
  const group = screen.getByRole("group").element();
  expect(visibleShadows(group)).toEqual([]);

  await userEvent.keyboard("{Tab}");
  await vi.waitFor(() => expect(group.getAttribute("data-focus-visible")).toBe("true"));
  expect(visibleShadows(group)).not.toEqual([]);

  await userEvent.click(screen.getByRole("button", { name: "Tăng" }));
  await vi.waitFor(() => expect(group.getAttribute("data-focus-visible")).not.toBe("true"));
  expect(visibleShadows(group)).toEqual([]);
});

test("a suffix follows the number", async () => {
  const screen = await render(<Level suffix=" %" />);
  const value = shownValue(screen.container);
  expect(value?.shadowRoot?.textContent ?? "").toContain("%");
});
