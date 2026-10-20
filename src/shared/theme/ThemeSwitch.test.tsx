import "@/app/globals.css";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ThemeSwitch } from "./ThemeSwitch";
import { THEME_COOKIE } from "./theme";

const root = document.documentElement;
const realMatchMedia = window.matchMedia.bind(window);
const realStartViewTransition = document.startViewTransition;

/** Answers the given media queries as told, and every other one as the browser does. */
function mediaAnswers(answers: Record<string, boolean>) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) =>
    query in answers
      ? ({ matches: answers[query], media: query, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList)
      : realMatchMedia(query),
  );
}

/** Starts on a light page whose choice is light. */
function startLight() {
  document.cookie = `${THEME_COOKIE}=light; path=/`;
  root.dataset.theme = "light";
  root.classList.remove("dark");
}

/** The view transitions started in the test, to look at them while they run and to end them after. */
let transitions: ViewTransition[] = [];
/** The animations of the old and the new look, read while the transition runs. */
let during: { pictured: string; newLook: string; easing: string; oldLook: string } | undefined;

beforeEach(() => {
  startLight();
  mediaAnswers({ "(prefers-color-scheme: dark)": false, "(prefers-reduced-motion: reduce)": false });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.startViewTransition = realStartViewTransition;
  for (const transition of transitions) transition.skipTransition();
  transitions = [];
  during = undefined;
  root.style.removeProperty("--theme-reveal-x");
  root.style.removeProperty("--theme-reveal-y");
  root.style.removeProperty("--theme-reveal-r");
  root.style.removeProperty("--theme-reveal-from");
  delete root.dataset.theme;
  root.classList.remove("dark");
  document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`;
});

test("choosing another theme reveals it in a circle growing from the chosen button, and keeps the choice", async () => {
  const start = vi.spyOn(document, "startViewTransition").mockImplementation((update) => {
    const transition = realStartViewTransition.call(document, update);
    transitions.push(transition);
    // Read as soon as it is ready (it may be over by the time the test goes on, on a busy machine).
    void transition.ready.then(() => {
      during = {
        // HeroUI names nothing at the root (view-transition-name: none), which would leave no picture to animate.
        pictured: getComputedStyle(root).viewTransitionName,
        newLook: getComputedStyle(root, "::view-transition-new(root)").animationName,
        easing: getComputedStyle(root, "::view-transition-new(root)").animationTimingFunction,
        oldLook: getComputedStyle(root, "::view-transition-old(root)").animationName,
      };
    });
    return transition;
  });
  const screen = await render(<ThemeSwitch />);
  const dark = screen.getByRole("radio", { name: "Tối" });

  await dark.click();

  expect(start).toHaveBeenCalledTimes(1);
  const button = dark.element().getBoundingClientRect();
  expect(parseFloat(root.style.getPropertyValue("--theme-reveal-x"))).toBeCloseTo(button.left + button.width / 2, 0);
  expect(parseFloat(root.style.getPropertyValue("--theme-reveal-y"))).toBeCloseTo(button.top + button.height / 2, 0);
  // The circle grows far enough to cover the farthest corner of the screen from there.
  const x = button.left + button.width / 2;
  const y = button.top + button.height / 2;
  const farthest = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  expect(parseFloat(root.style.getPropertyValue("--theme-reveal-r"))).toBeGreaterThanOrEqual(farthest);
  // It starts as large as the button, so the change shows under the pointer from the first frame.
  expect(parseFloat(root.style.getPropertyValue("--theme-reveal-from"))).toBeCloseTo(button.width / 2, 0);

  // While it runs, the new look is drawn over the old one through the growing circle, fast at first and settling
  // slowly (an ease-out, so it answers at once); the old one is not faded out.
  await transitions[0].ready;
  expect(during).toEqual({ pictured: "root", newLook: "theme-reveal", easing: "cubic-bezier(0.2, 0, 0, 1)", oldLook: "none" });
  // Once it is over, the page is left as it was (only a theme change animates this way).
  await transitions[0].finished;
  expect(root.classList.contains("theme-reveal")).toBe(false);

  expect(root.dataset.theme).toBe("dark");
  expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  await expect.element(dark).toBeChecked();
});

test("asked for less motion, the theme changes at once", async () => {
  mediaAnswers({ "(prefers-color-scheme: dark)": false, "(prefers-reduced-motion: reduce)": true });
  const start = vi.spyOn(document, "startViewTransition");
  const screen = await render(<ThemeSwitch />);

  await screen.getByRole("radio", { name: "Tối" }).click();

  expect(start).not.toHaveBeenCalled();
  expect(root.dataset.theme).toBe("dark");
});

test("where the browser cannot animate the change, the theme changes at once", async () => {
  // @ts-expect-error: a browser without view transitions.
  document.startViewTransition = undefined;
  const screen = await render(<ThemeSwitch />);

  await screen.getByRole("radio", { name: "Tối" }).click();

  expect(root.dataset.theme).toBe("dark");
  expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
});

test("a choice that leaves the colours as they are (the system's, light like the page) is kept without an animation", async () => {
  const start = vi.spyOn(document, "startViewTransition");
  const screen = await render(<ThemeSwitch />);

  await screen.getByRole("radio", { name: "Theo hệ thống" }).click();

  expect(start).not.toHaveBeenCalled();
  expect(root.dataset.theme).toBe("light");
  expect(document.cookie).toContain(`${THEME_COOKIE}=system`);
});

test("a reveal the browser gives up on (resized, or a second change on top) leaves no unhandled error, and the choice is kept", async () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (event: PromiseRejectionEvent) => {
    unhandled.push(event.reason);
    event.preventDefault();
  };
  window.addEventListener("unhandledrejection", onUnhandled);
  vi.spyOn(document, "startViewTransition").mockImplementation((update) => {
    const transition = realStartViewTransition.call(document, update);
    transitions.push(transition);
    // Given up on before it could start: its `ready` is rejected.
    transition.skipTransition();
    return transition;
  });
  try {
    const screen = await render(<ThemeSwitch />);
    await screen.getByRole("radio", { name: "Tối" }).click();
    await transitions[0].finished;
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(unhandled).toEqual([]);
    expect(root.dataset.theme).toBe("dark");
    expect(root.classList.contains("theme-reveal")).toBe(false);
  } finally {
    window.removeEventListener("unhandledrejection", onUnhandled);
  }
});
