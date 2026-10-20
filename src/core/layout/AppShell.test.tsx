import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type UserDto } from "@/shared/api/generated/portalApi";
import { hitsAround } from "@/shared/lib/hitArea.testing";
import { signedIn } from "@/shared/session/sessionSlice";
import { AppShell } from "./AppShell";

const navigation = vi.hoisted(() => ({ pathname: "/", push: (() => {}) as (href: string) => void }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: (href: string) => navigation.push(href), replace: () => {}, prefetch: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const user = { id: 1, fullName: "Nguyễn Văn An", userName: "an", email: "an@congty.vn", roles: [] } as unknown as UserDto;

function renderShell(pathname = "/") {
  navigation.pathname = pathname;
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  void store.dispatch(portalApi.util.upsertQueryData("getCurrentUser", undefined, { user, permissions: [] }));
  return render(
    <Provider store={store}>
      <AppShell defaultCollapsed={false}>
        <p>Nội dung trang</p>
      </AppShell>
    </Provider>,
  );
}

/** Opens the sidebar sheet, then the account menu inside it. */
async function openAccountMenu(screen: Awaited<ReturnType<typeof renderShell>>) {
  await screen.getByRole("button", { name: "Ẩn/hiện menu (Ctrl+B)" }).click();
  const sheet = screen.getByRole("dialog", { name: "Menu chính" });
  await expect.element(sheet).toBeVisible();
  const trigger = sheet.getByRole("button", { name: "Tài khoản: Nguyễn Văn An" });
  await trigger.click();
  // Each menu is named after the trigger (aria-labelledby), so the account menu is found by its first item.
  const menu = screen.getByRole("menuitem", { name: "Hồ sơ" });
  await expect.element(menu).toBeVisible();
  return { sheet, trigger, menu };
}

/** Alpha of a computed colour, whatever space it is written in: the canvas resolves it. */
function alphaOf(color: string) {
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return context.getImageData(0, 0, 1, 1).data[3] / 255;
}

/** Answers every request (the profile drawer loads the profile and the organization) with the user's profile. */
const profile = { userId: 1, fullName: user.fullName, emailConfirmed: true, gender: null, assignments: [] };

beforeEach(() => {
  vi.spyOn(window, "fetch").mockImplementation(async () => Response.json(profile));
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.theme;
  document.documentElement.classList.remove("dark");
  await page.viewport(1000, 800);
});

describe("on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  test.each(["light", "dark"] as const)("the account menu opens next to its trigger, opaque (%s), and the sheet stays open", async (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    const screen = await renderShell();
    const { sheet, trigger, menu } = await openAccountMenu(screen);

    // No hidden copy of the menu is left in the page (the desktop rail's), whose trigger has no box: opened, that
    // menu lands at the top of the screen. Every account trigger is the one in the sheet.
    const triggers = [...document.querySelectorAll('button[aria-label^="Tài khoản:"]')];
    expect(triggers).toEqual([trigger.element()]);

    // Let the opening animation settle, then measure where the menu ended up.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await expect.element(sheet).toBeVisible();
    await expect.element(menu).toBeVisible();

    const popover = menu.element().closest(".dropdown__popover")!;
    expect(alphaOf(getComputedStyle(popover).backgroundColor)).toBe(1);
    expect(getComputedStyle(popover).opacity).toBe("1");

    const triggerRect = trigger.element().getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = Math.min(Math.abs(popoverRect.bottom - triggerRect.top), Math.abs(popoverRect.top - triggerRect.bottom));
    expect(gap).toBeLessThan(80);
  });

  test("choosing the profile closes the sheet and opens the profile", async () => {
    const screen = await renderShell();
    const { sheet } = await openAccountMenu(screen);

    await screen.getByRole("menuitem", { name: "Hồ sơ" }).click();

    await expect.element(screen.getByRole("dialog", { name: "Hồ sơ của tôi" })).toBeVisible();
    await expect.element(sheet).not.toBeInTheDocument();
  });

  test("choosing the settings closes the sheet and goes to the settings", async () => {
    const push = vi.spyOn(navigation, "push");
    const screen = await renderShell();
    const { sheet } = await openAccountMenu(screen);

    await screen.getByRole("menuitem", { name: "Cài đặt" }).click();

    expect(push).toHaveBeenCalledWith("/settings");
    await expect.element(sheet).not.toBeInTheDocument();
  });

  test("the sheet's close button takes a tap of at least 40px, though it looks the same size", async () => {
    const screen = await renderShell();
    await screen.getByRole("button", { name: "Ẩn/hiện menu (Ctrl+B)" }).click();
    const close = screen.getByRole("button", { name: "Đóng menu" });
    await expect.element(close).toBeVisible();
    // Let the sheet finish sliding in, so the button is where it will stay.
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(hitsAround(close.element(), 18)).toBe(true);
    expect(close.element().getBoundingClientRect().width).toBeLessThan(40);
  });

  test("the page keeps 12px of padding on each side", async () => {
    const screen = await renderShell();
    const main = screen.getByRole("main").element();
    expect(getComputedStyle(main).paddingLeft).toBe("12px");
    expect(getComputedStyle(main).paddingRight).toBe("12px");
  });
});

test("from the sm breakpoint up, the page keeps 24px of padding", async () => {
  await page.viewport(640, 800);
  const screen = await renderShell();
  expect(getComputedStyle(screen.getByRole("main").element()).paddingLeft).toBe("24px");
});

/** The sidebar shown in the page itself (not in the menu sheet). */
const inlineSidebar = () => [...document.querySelectorAll('nav[aria-label="Điều hướng chính"]')]
  .filter((nav) => !nav.closest('[role="dialog"]') && nav.getBoundingClientRect().width > 0);

test.each([[844, 390, false], [390, 844, false], [1024, 768, true], [1280, 800, true]])("at %ix%i the sidebar is in the page: %s", async (width, height, inline) => {
  await page.viewport(width, height);
  const screen = await renderShell();
  await expect.element(screen.getByRole("main")).toBeVisible();
  expect(inlineSidebar()).toHaveLength(inline ? 1 : 0);
  if (inline) {
    // A tablet's and a desktop's sidebar has its own button, in its header; the top bar has none.
    await expect.element(screen.getByRole("banner").getByRole("button", { name: "Ẩn/hiện menu (Ctrl+B)" })).not.toBeInTheDocument();
    await screen.getByRole("button", { name: "Thu gọn menu" }).click();
    // It narrows the sidebar to its icons.
    await expect.element(screen.getByRole("dialog", { name: "Menu chính" })).not.toBeInTheDocument();
    await vi.waitFor(() => expect(inlineSidebar()[0].closest("[data-state]")?.getAttribute("data-state")).toBe("collapsed"));
  } else {
    // A phone's, upright or sideways, is in the top bar and opens the menu as a sheet.
    await screen.getByRole("button", { name: "Ẩn/hiện menu (Ctrl+B)" }).click();
    await expect.element(screen.getByRole("dialog", { name: "Menu chính" })).toBeVisible();
  }
});

const railState = () => inlineSidebar()[0]?.closest("[data-state]")?.getAttribute("data-state");
const sidebarCookie = () => document.cookie.split("; ").find((pair) => pair.startsWith("portal_sidebar="));

test.each([[768, 1024], [820, 1180]])("on an upright tablet (%ix%i) the sidebar starts as icons and opens without forgetting the desktop choice", async (width, height) => {
  await page.viewport(width, height);
  const screen = await renderShell();
  await vi.waitFor(() => expect(railState()).toBe("collapsed"));
  // The rail is narrow, so the page keeps its width; the desktop choice (expanded) is not overwritten.
  expect(inlineSidebar()[0].closest("[data-state]")!.getBoundingClientRect().width).toBe(60);
  expect(sidebarCookie()).toBe("portal_sidebar=expanded");

  await screen.getByRole("button", { name: "Mở rộng menu" }).click();
  await vi.waitFor(() => expect(railState()).toBe("expanded"));
  expect(sidebarCookie()).toBe("portal_sidebar=expanded");
});

test("turned sideways, a tablet's sidebar is as the desktop choice left it", async () => {
  await page.viewport(768, 1024);
  await renderShell();
  await vi.waitFor(() => expect(railState()).toBe("collapsed"));
  await page.viewport(1024, 768);
  await vi.waitFor(() => expect(railState()).toBe("expanded"));
});

test("the settings page shows its title in the top bar, without a sidebar entry", async () => {
  const screen = await renderShell("/settings");

  const header = screen.getByRole("banner");
  await expect.element(header.getByText("Cài đặt")).toBeVisible();
  const sidebar = screen.getByRole("navigation", { name: "Điều hướng chính" });
  await expect.element(sidebar.getByRole("link", { name: "Lịch", exact: true })).toBeVisible();
  await expect.element(sidebar.getByText("Cài đặt")).not.toBeInTheDocument();
});

const box = (element: Element) => element.getBoundingClientRect();

/**
 * Off a phone the sidebar and a thin frame around the page are one surface, and the page is a sheet with rounded top
 * corners set into it (after Shopify's admin, whose measures these are).
 */
describe("the frame, off a phone", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  const rail = () => inlineSidebar()[0].closest<HTMLElement>("[data-state]")!;

  test.each(["light", "dark"] as const)("the sidebar is the frame's colour, unbordered, and the page is a different sheet set 4px into it (%s)", async (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    const screen = await renderShell();
    await expect.element(screen.getByRole("main")).toBeVisible();

    const frame = getComputedStyle(rail()).backgroundColor;
    expect(getComputedStyle(rail()).borderRightWidth).toBe("0px");
    const header = screen.getByRole("banner").element();
    // The frame shows above the sheet, 4px of it, and the sheet's top corners are rounded.
    expect(getComputedStyle(header).paddingTop).toBe("4px");
    expect(getComputedStyle(header).backgroundColor).toBe(frame);
    const bar = header.firstElementChild!;
    expect(getComputedStyle(bar).borderTopLeftRadius).toBe("16px");
    expect(getComputedStyle(bar).borderTopRightRadius).toBe("16px");
    const sheet = getComputedStyle(screen.getByRole("main").element()).backgroundColor;
    expect(getComputedStyle(bar).backgroundColor).toBe(sheet);
    expect(sheet).not.toBe(frame);
    // 4px of frame on the right too, past the sheet's edge.
    expect(document.documentElement.clientWidth - box(screen.getByRole("main").element()).right).toBe(4);
  });

  test("the sidebar is 220px wide, 60px as icons, and its entries are 30px tall, one under another", async () => {
    const screen = await renderShell();
    await expect.element(screen.getByRole("main")).toBeVisible();
    expect(box(rail()).width).toBe(220);
    const links = [...rail().querySelectorAll("nav a")];
    expect(links.length).toBeGreaterThan(1);
    for (const link of links) expect(box(link).height).toBe(30);
    expect(box(links[1]).top - box(links[0]).bottom).toBe(0);
    expect(getComputedStyle(links[0]).borderRadius).toBe("12px");

    await screen.getByRole("button", { name: "Thu gọn menu" }).click();
    await vi.waitFor(() => expect(box(rail()).width).toBe(60));
    // As icons, each entry is a 32px box in the middle of the rail.
    for (const link of links) {
      expect(box(link).width).toBe(32);
      expect(box(link).left).toBe(14);
    }
  });

  test("the sidebar's button sits at its header's end, round, 32x30; collapsed, it shows the logo until pointed at", async () => {
    const screen = await renderShell();
    const collapse = screen.getByRole("button", { name: "Thu gọn menu" });
    await expect.element(collapse).toBeVisible();
    expect(collapse.element().getAttribute("aria-expanded")).toBe("true");
    expect(box(collapse.element()).width).toBe(32);
    expect(box(collapse.element()).height).toBe(30);
    expect(parseFloat(getComputedStyle(collapse.element()).borderRadius)).toBeGreaterThanOrEqual(15);
    expect(box(rail()).right - box(collapse.element()).right).toBeLessThan(16);

    await collapse.click();
    const expand = screen.getByRole("button", { name: "Mở rộng menu" });
    await expect.element(expand).toBeVisible();
    expect(expand.element().getAttribute("aria-expanded")).toBe("false");
    const logo = expand.element().querySelector("span[aria-hidden]")!;
    const icon = expand.element().querySelector("svg")!;
    expect(logo.textContent).toBe("P");
    expect(box(icon).width).toBe(0);

    await userEvent.hover(expand);
    await vi.waitFor(() => expect(box(icon).width).toBeGreaterThan(0));
    expect(box(logo).width).toBe(0);
  });

  test("pointed at, the sidebar's button says what it does and its shortcut", async () => {
    const screen = await renderShell();
    await userEvent.hover(screen.getByRole("button", { name: "Thu gọn menu" }));
    const tooltip = screen.getByRole("tooltip");
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().textContent).toContain("Thu gọn menu");
    expect([...tooltip.element().querySelectorAll("kbd")].map((key) => key.textContent)).toEqual(["Ctrl", "B"]);
  });

  test("an entry under the pointer takes a lighter wash than the current page's", async () => {
    await renderShell("/");
    await vi.waitFor(() => expect(rail().querySelector('nav a[href="/meetings"]')).toBeTruthy());
    const current = rail().querySelector<HTMLElement>('nav a[aria-current="page"]')!;
    const other = rail().querySelector<HTMLElement>('nav a[href="/meetings"]')!;
    await userEvent.hover(other);
    await vi.waitFor(() => expect(alphaOf(getComputedStyle(other).backgroundColor)).toBeGreaterThan(0));
    expect(alphaOf(getComputedStyle(other).backgroundColor)).toBeCloseTo(0.06, 1);
    expect(alphaOf(getComputedStyle(current).backgroundColor)).toBeCloseTo(0.11, 1);
  });

  test("the line above the account stops 20px short of the sidebar's edges", async () => {
    const screen = await renderShell();
    await expect.element(screen.getByRole("button", { name: "Tài khoản: Nguyễn Văn An" })).toBeVisible();
    const footer = rail().lastElementChild!;
    expect(getComputedStyle(footer).borderTopWidth).toBe("0px");
    const line = getComputedStyle(footer, "::before");
    expect(line.height).toBe("1px");
    expect(line.left).toBe("20px");
    expect(line.width).toBe("180px");
  });

  test("a glow rises from the sidebar's foot, behind its content and never in the way of the pointer", async () => {
    const screen = await renderShell();
    const account = screen.getByRole("button", { name: "Tài khoản: Nguyễn Văn An" });
    await expect.element(account).toBeVisible();
    const glow = rail().querySelector(".sidebar-glow")!;
    expect(glow).toBeTruthy();
    expect(glow.getAttribute("aria-hidden")).toBe("true");
    expect(box(glow).bottom).toBe(box(rail()).bottom);
    expect(getComputedStyle(glow).backgroundImage).toContain("linear-gradient");
    expect(getComputedStyle(glow).pointerEvents).toBe("none");
    const middle = box(account.element());
    expect(document.elementFromPoint(middle.left + middle.width / 2, middle.top + middle.height / 2)?.closest("button")).toBe(account.element());
  });
});

test("on a phone there is no frame: the top bar and the page run edge to edge", async () => {
  await page.viewport(390, 844);
  const screen = await renderShell();
  const header = screen.getByRole("banner").element();
  await expect.element(screen.getByRole("main")).toBeVisible();
  expect(getComputedStyle(header).paddingTop).toBe("0px");
  expect(getComputedStyle(header.firstElementChild!).borderTopLeftRadius).toBe("0px");
  expect(box(screen.getByRole("main").element()).right).toBe(document.documentElement.clientWidth);
});
