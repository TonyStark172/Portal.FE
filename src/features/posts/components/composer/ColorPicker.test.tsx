import "@/app/globals.css";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { ColorPicker } from "./ColorPicker";

const byLabel = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`);
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Màu"]');

async function open() {
  await userEvent.click(await vi.waitUntil(() => byLabel("Màu")));
  return vi.waitUntil(() => dialog());
}

async function pick(label: string) {
  await userEvent.click(await vi.waitUntil(() => byLabel(label)));
  await vi.waitUntil(() => !dialog());
}

function Picker(props: Partial<Parameters<typeof ColorPicker>[0]>) {
  return <ColorPicker textColor={null} highlight={null} onTextColor={() => {}} onHighlight={() => {}} {...props} />;
}

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    // No storage: the recent colours simply start empty.
  }
});

describe("the colour picker", () => {
  test("offers text colours and highlights in one popover", async () => {
    const onTextColor = vi.fn();
    const onHighlight = vi.fn();
    await render(<Picker onTextColor={onTextColor} onHighlight={onHighlight} />);

    const popover = await open();
    expect([...popover.querySelectorAll("h3")].map((h) => h.textContent)).toEqual(["Màu chữ", "Màu nền chữ"]);

    await pick("Màu chữ: Đỏ");
    expect(onTextColor).toHaveBeenCalledWith("red");

    await open();
    await pick("Màu nền chữ: Vàng");
    expect(onHighlight).toHaveBeenCalledWith("yellow");
  });

  test("has Tiptap's ten text colours and ten highlights", async () => {
    await render(<Picker />);

    const popover = await open();
    const names = (title: string) =>
      [...popover.querySelectorAll(`[aria-label="${title}"] button`)].map((b) => b.getAttribute("aria-label")!.split(": ")[1]);
    const colours = ["Xám", "Nâu", "Cam", "Vàng", "Xanh lá", "Xanh dương", "Tím", "Hồng", "Đỏ"];
    expect(names("Màu chữ")).toEqual(["Mặc định", ...colours]);
    expect(names("Màu nền chữ")).toEqual(["Không tô", ...colours]);
  });

  test("clears either colour from its first swatch", async () => {
    const onTextColor = vi.fn();
    const onHighlight = vi.fn();
    await render(<Picker textColor="red" highlight="yellow" onTextColor={onTextColor} onHighlight={onHighlight} />);

    await open();
    await pick("Màu chữ: Mặc định");
    expect(onTextColor).toHaveBeenCalledWith(null);

    await open();
    await pick("Màu nền chữ: Không tô");
    expect(onHighlight).toHaveBeenCalledWith(null);
  });

  test("keeps the colours used last on top, the latest first", async () => {
    const onTextColor = vi.fn();
    await render(<Picker onTextColor={onTextColor} />);

    await open();
    await pick("Màu chữ: Đỏ");
    await open();
    await pick("Màu nền chữ: Vàng");

    const popover = await open();
    const recent = popover.querySelector('[aria-label="Dùng gần đây"]')!;
    expect([...recent.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Màu nền chữ: Vàng",
      "Màu chữ: Đỏ",
    ]);

    // A recent colour is applied again from there.
    await userEvent.click(recent.querySelector<HTMLElement>('[aria-label="Màu chữ: Đỏ"]')!);
    expect(onTextColor).toHaveBeenCalledTimes(2);
  });

  test("marks only a colour in use, never the default text colour or no highlight", async () => {
    await render(<Picker textColor={null} highlight="yellow" />);

    const popover = await open();
    const pressed = [...popover.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.getAttribute("aria-label"));
    expect(pressed).toEqual(["Màu nền chữ: Vàng"]);
  });

  test("shows the colours in use on its button", async () => {
    await render(<Picker textColor="red" highlight="yellow" />);

    const preview = (await vi.waitUntil(() => byLabel("Màu"))).querySelector<HTMLElement>("[data-color-preview]")!;
    expect(preview.style.color).toBe("var(--post-red)");
    expect(preview.style.background).toBe("var(--post-mark-yellow)");
  });
});
