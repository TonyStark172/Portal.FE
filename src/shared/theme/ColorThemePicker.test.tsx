import "@/app/globals.css";
import { afterEach, beforeEach, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { ColorThemePicker } from "./ColorThemePicker";
import { applyColorTheme, COLOR_THEME_COOKIE, readColorTheme, themeScript } from "./theme";

const root = document.documentElement;
const accent = () => getComputedStyle(root).getPropertyValue("--accent").trim();

beforeEach(() => {
  root.dataset.theme = "light";
});

afterEach(() => {
  delete root.dataset.theme;
  delete root.dataset.colorTheme;
  document.cookie = `${COLOR_THEME_COOKIE}=; path=/; max-age=0`;
});

async function open() {
  const screen = await render(<ColorThemePicker />);
  await screen.getByRole("button", { name: "Màu giao diện" }).click();
  return screen;
}

test("with nothing chosen it is the default theme: HeroUI's colours, and no attribute on the page", async () => {
  const before = accent();
  const screen = await open();
  await expect.element(screen.getByRole("radio", { name: "Mặc định" })).toBeChecked();
  expect(readColorTheme()).toBe("default");
  expect(root.dataset.colorTheme).toBeUndefined();
  expect(accent()).toBe(before);
});

test("choosing a theme changes the colours at once, and remembers it", async () => {
  const before = accent();
  const screen = await open();
  await screen.getByRole("radio", { name: "Lavender" }).click();
  await expect.element(screen.getByRole("radio", { name: "Lavender" })).toBeChecked();
  expect(root.dataset.colorTheme).toBe("lavender");
  expect(accent()).not.toBe(before);
  expect(document.cookie).toContain(`${COLOR_THEME_COOKIE}=lavender`);
});

test("the button is a ball in the current theme's colour", async () => {
  const screen = await open();
  const ball = () => getComputedStyle(screen.getByRole("button", { name: "Màu giao diện" }).element().querySelector("span")!).backgroundImage;
  const before = ball();
  expect(before).toContain("radial-gradient");
  await screen.getByRole("radio", { name: "Netflix" }).click();
  await expect.poll(ball).not.toBe(before);
});

test("going back to the default takes the attribute off again", async () => {
  applyColorTheme("mint");
  document.cookie = `${COLOR_THEME_COOKIE}=mint; path=/`;
  const screen = await open();
  await screen.getByRole("radio", { name: "Mặc định" }).click();
  expect(root.dataset.colorTheme).toBeUndefined();
  expect(readColorTheme()).toBe("default");
});

test("every theme has colours for both the light and the dark page", async () => {
  const defaults = accent();
  for (const theme of ["sky", "lavender", "mint", "netflix", "uber", "brutalism", "glass", "mouve"] as const) {
    applyColorTheme(theme);
    for (const mode of ["light", "dark"]) {
      root.dataset.theme = mode;
      expect(accent(), `${theme} on ${mode}`).not.toBe(defaults);
    }
    root.dataset.theme = "light";
  }
});

test("on a light page a table stands out: its header from the page, and its rows from its header", () => {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const green = (token: string) => {
    context.fillStyle = getComputedStyle(root).getPropertyValue(token).trim();
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[1];
  };
  // Glass is left out: its surfaces are see-through, over a gradient.
  for (const theme of ["default", "sky", "lavender", "mint", "netflix", "uber", "brutalism", "mouve"] as const) {
    applyColorTheme(theme);
    expect(green("--background") - green("--surface-secondary"), `${theme}: header on the page`).toBeGreaterThanOrEqual(4);
    expect(green("--surface") - green("--surface-secondary"), `${theme}: rows on the header`).toBeGreaterThanOrEqual(10);
  }
});

test("in Glass a table is solid as a whole, so its frame and header are one colour with no seam", async () => {
  applyColorTheme("glass");
  const screen = await render(
    <div className="table-root table-root--primary table-fill">
      <table><thead><tr><th className="table__column">A</th></tr></thead><tbody><tr><td className="table__cell">B</td></tr></tbody></table>
    </div>,
  );
  const frame = getComputedStyle(screen.container.querySelector(".table-root")!).backgroundColor;
  expect(frame).toBe(getComputedStyle(screen.container.querySelector(".table__column")!).backgroundColor);
  expect(frame).not.toContain("/");
  expect(getComputedStyle(screen.container.querySelector(".table__cell")!).backgroundColor).not.toContain("/");
});

test("the accent as text reads on a card, in every chosen theme on both pages", async () => {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const pixel = (color: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  };
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((value) => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const screen = await render(<span className="text-accent">x</span>);
  const text = screen.container.querySelector("span")!;
  // Glass is left out of the card: its cards are see-through, and its accent is black or white.
  for (const theme of ["sky", "lavender", "mint", "netflix", "uber", "brutalism", "mouve"] as const) {
    applyColorTheme(theme);
    for (const mode of ["light", "dark"]) {
      root.dataset.theme = mode;
      const [a, b] = [luminance(pixel(getComputedStyle(text).color)), luminance(pixel(getComputedStyle(root).getPropertyValue("--surface").trim()))];
      expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), `${theme} on ${mode}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("charts follow a chosen theme, and the default theme keeps its own palette", async () => {
  const screen = await render(<span style={{ color: "var(--chart-1)", backgroundColor: "var(--chart-3)" }}>x</span>);
  const sample = screen.container.querySelector("span")!;
  const defaults = getComputedStyle(sample).color;
  applyColorTheme("netflix");
  const chosen = getComputedStyle(sample);
  expect(chosen.color).not.toBe(defaults);
  expect(chosen.backgroundColor).not.toBe(chosen.color);
  applyColorTheme("default");
  expect(getComputedStyle(sample).color).toBe(defaults);
});

test("neighbouring slices of a chart are easy to tell apart, in every chosen theme on both pages", () => {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const luminance = (token: string) => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = getComputedStyle(root).getPropertyValue(token).trim();
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map((value) => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const theme of ["sky", "lavender", "mint", "netflix", "uber", "brutalism", "glass", "mouve"] as const) {
    applyColorTheme(theme);
    for (const mode of ["light", "dark"]) {
      root.dataset.theme = mode;
      const steps = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map(luminance);
      steps.slice(1).forEach((step, i) => {
        const [low, high] = [step, steps[i]].sort((x, y) => x - y);
        expect((high + 0.05) / (low + 0.05), `${theme} on ${mode}: steps ${i + 1} and ${i + 2}`).toBeGreaterThanOrEqual(1.25);
      });
    }
  }
});

test("all nine themes are offered", async () => {
  const screen = await open();
  expect(screen.getByRole("radio").elements()).toHaveLength(9);
});

test("Brutalism is square; Glass sees through to a gradient on the page", () => {
  applyColorTheme("brutalism");
  expect(getComputedStyle(root).getPropertyValue("--radius").trim()).toBe("0px");

  applyColorTheme("glass");
  expect(getComputedStyle(root).getPropertyValue("--app-sheet").trim()).toBe("transparent");
  expect(getComputedStyle(root).backgroundImage).toContain("linear-gradient");
});

test("the script run before the first paint picks the remembered theme, and ignores an unknown one", () => {
  document.cookie = `${COLOR_THEME_COOKIE}=sky; path=/`;
  new Function(themeScript)();
  expect(root.dataset.colorTheme).toBe("sky");

  delete root.dataset.colorTheme;
  document.cookie = `${COLOR_THEME_COOKIE}=skyline; path=/`;
  new Function(themeScript)();
  expect(root.dataset.colorTheme).toBeUndefined();
  expect(readColorTheme()).toBe("default");
});
