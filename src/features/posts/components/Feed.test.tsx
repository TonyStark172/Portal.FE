import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import { portalApi, type PostDto, type PostPage, type UserDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { signedIn } from "@/shared/session/sessionSlice";
import { Feed } from "./Feed";

/** Each render of the composer, counted (it is the heavy part: the editor and its toolbars). */
const composerRenders = vi.hoisted(() => ({ count: 0 }));
vi.mock("./composer/PostComposer", async (importOriginal) => {
  const original = await importOriginal<typeof import("./composer/PostComposer")>();
  return { ...original, PostComposer: (props: Parameters<typeof original.PostComposer>[0]) => { composerRenders.count++; return original.PostComposer(props); } };
});

const post = (id: number): PostDto => ({
  id,
  kind: "Normal" as PostDto["kind"],
  contentHtml: `<p>Bài số ${id}</p>`,
  author: { id: 1, fullName: "Nguyễn Văn An" } as PostDto["author"],
  createdAt: "2026-10-01T08:00:00Z",
  media: [],
  attachments: [],
  mentions: [],
  mentionsEveryone: false,
  reactions: [],
  myReaction: null,
  isPinned: false,
  canPin: false,
  canEdit: false,
  canDelete: false,
  version: 1,
});

/** Portal.BE answering the feed with one page of `count` posts and nothing else pinned. */
function serve(count: number) {
  const page: PostPage = { items: Array.from({ length: count }, (_, i) => post(count - i)), nextCursor: null };
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.includes("/pinned")) return Response.json([]);
    if (url.includes("/api/Posts")) return Response.json(page);
    return new Response(null, { status: 404 });
  });
}

async function signedInStore(permissions: string[] = []) {
  const store = makeStore();
  store.dispatch(signedIn({ accessToken: "token", accessTokenExpiresAt: "2099-01-01T00:00:00Z" }));
  await store.dispatch(
    portalApi.util.upsertQueryData("getCurrentUser", undefined, {
      user: { id: 1, fullName: "Nguyễn Văn An" } as UserDto,
      permissions,
    }),
  );
  return store;
}

const shown = () => [...document.querySelectorAll(".post-content")].map((el) => el.textContent);

afterEach(() => {
  vi.restoreAllMocks();
  window.scrollTo(0, 0);
});

describe("the feed", () => {
  test.each([[390, 844], [1280, 800]])("at %ix%i the new-post box stays under the top bar as the posts scroll, on a band of the page's colour", async (width, height) => {
    await page.viewport(width, height);
    try {
      serve(30);
      await render(
        <Provider store={await signedInStore([Permissions.Posts.Create])}>
          <Feed />
        </Provider>,
      );
      await vi.waitUntil(() => shown().includes("Bài số 30"), { timeout: 5000 });
      const launcher = [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent === "Đăng bài mới…")!.closest<HTMLElement>(".card")!;
      const css = getComputedStyle(document.documentElement);
      const px = (name: string) => parseFloat(css.getPropertyValue(name)) * (css.getPropertyValue(name).trim().endsWith("rem") ? 16 : 1);
      const top = px("--app-header-height") + px("--app-main-padding");

      window.scrollTo(0, 1500);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      expect(window.scrollY).toBeGreaterThan(1000);
      expect(Math.abs(launcher.getBoundingClientRect().top - top)).toBeLessThanOrEqual(1);
      // Between the top bar and the box, and beside its top corners, the posts going under do not show; beside its
      // bottom corners they do, so the box's round corners are not boxed in by a square band (a proxy: the band's
      // colour is painted down to the height of the box's corner radius from its bottom, no further).
      const band = launcher.closest<HTMLElement>("[data-composer-band]")!;
      const style = getComputedStyle(band);
      expect(style.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
      expect(style.backgroundImage).not.toBe("none");
      expect(style.backgroundSize).toBe(`100% calc(100% - ${getComputedStyle(launcher).borderBottomLeftRadius})`);
      const box = launcher.getBoundingClientRect();
      for (const [x, y] of [[box.left + box.width / 2, px("--app-header-height") + 2], [box.left + 2, box.top + 2]]) {
        expect(band.contains(document.elementFromPoint(x, y))).toBe(true);
      }
    } finally { await page.viewport(1000, 800); }
  });

  test("keeps only the posts near the viewport in the page, however many are loaded", async () => {
    serve(500);
    await render(
      <Provider store={await signedInStore()}>
        <Feed />
      </Provider>,
    );

    await vi.waitUntil(() => shown().includes("Bài số 500"), { timeout: 5000 });
    expect(shown().length).toBeLessThan(30);
  });

  test("shows placeholder posts under the list while the next page loads", async () => {
    vi.spyOn(window, "fetch").mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/pinned")) return Response.json([]);
      if (url.includes("cursor=")) return new Promise<Response>(() => {}); // the next page never arrives
      if (url.includes("/api/Posts"))
        return Response.json({ items: Array.from({ length: 20 }, (_, i) => post(20 - i)), nextCursor: "p2" });
      return new Response(null, { status: 404 });
    });
    await render(
      <Provider store={await signedInStore()}>
        <Feed />
      </Provider>,
    );
    await vi.waitUntil(() => shown().includes("Bài số 20"), { timeout: 5000 });

    const loading = await vi.waitUntil(
      () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return document.querySelector<HTMLElement>('[role="status"]');
      },
      { timeout: 5000 },
    );
    expect(loading.querySelectorAll('[data-slot="card"]').length).toBeGreaterThanOrEqual(2);
  });
});

describe("the new-post box", () => {
  const launcher = () => [...document.querySelectorAll<HTMLElement>("button")].find((b) => /^(Đăng bài mới…|Tiếp tục bài đang soạn…)$/.test(b.textContent ?? ""));
  /** The open composer, when it is shown (not folded away). */
  const composer = () => document.querySelector<HTMLElement>("[data-composer][data-open]");
  const frames = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const settle = () => new Promise((resolve) => setTimeout(resolve, 400));
  /** A swipe or wheel over the posts, as a person scrolls the feed. */
  async function scrollTheFeed(by: number) {
    // A post, not the composer's own editor (which is a .post-content too).
    const post = [...document.querySelectorAll<HTMLElement>(".post-content")].find((element) => !element.closest("[data-composer-band]"))!;
    post.dispatchEvent(new WheelEvent("wheel", { deltaY: by, bubbles: true }));
    window.scrollBy(0, by);
    await frames();
  }

  async function renderFeed() {
    serve(30);
    const screen = await render(
      <Provider store={await signedInStore([Permissions.Posts.Create])}>
        <Feed />
      </Provider>,
    );
    await vi.waitUntil(() => shown().includes("Bài số 30"), { timeout: 5000 });
    return screen;
  }

  test("the composer is ready before it is first opened, so opening is only the animation", async () => {
    await renderFeed();
    // Made when the browser is idle, hidden.
    await vi.waitUntil(() => document.querySelector('[data-composer] input[aria-label="Tiêu đề"]'), { timeout: 3000 });
    expect(composer()).toBeNull();
    expect(document.querySelector("[data-composer]")).toHaveAttribute("inert");
  });

  test("it opens over the feed where the box is pinned, moving nothing, and takes the focus", async () => {
    await renderFeed();
    // A post, not the composer's own editor (made ahead, hidden, a .post-content too).
    const post = [...document.querySelectorAll<HTMLElement>(".post-content")].find((element) => !element.closest("[data-composer-band]"))!;
    const before = post.getBoundingClientRect().top;

    launcher()!.click();
    const open = await vi.waitUntil(() => composer());
    await settle();

    expect(post.getBoundingClientRect().top).toBe(before);
    expect(open.contains(document.activeElement)).toBe(true);
    expect(Math.abs(open.getBoundingClientRect().top - launcher()!.closest(".card")!.getBoundingClientRect().top)).toBeLessThanOrEqual(1);
  });

  test("opened far down the feed, it opens where the box is pinned, on screen", async () => {
    await renderFeed();
    window.scrollTo(0, 1500);
    await frames();

    launcher()!.click();
    const open = await vi.waitUntil(() => composer());
    await settle();

    const box = open.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeLessThan(100);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(window.scrollY).toBeGreaterThan(1000);
  });

  test("opening and closing do not render the composer again, so nothing holds the animation's first frame back", async () => {
    await renderFeed();
    await vi.waitUntil(() => document.querySelector('[data-composer] input[aria-label="Tiêu đề"]'), { timeout: 3000 });
    await settle();
    const before = composerRenders.count;

    launcher()!.click();
    await vi.waitUntil(() => composer());
    await userEvent.keyboard("{Escape}");
    await vi.waitUntil(() => !composer());

    expect(composerRenders.count).toBe(before);
  });

  test("it fades and lifts in on opacity and transform only (nothing laid out again)", async () => {
    await renderFeed();
    const { transitionProperty, transitionDuration } = getComputedStyle(document.querySelector("[data-composer]")!);
    expect(transitionProperty).toContain("opacity");
    expect(transitionProperty).toContain("transform");
    expect(transitionProperty).not.toMatch(/height|grid-template-rows|all/);
    expect(parseFloat(transitionDuration)).toBeGreaterThan(0.1);
  });

  test("opening, its parts come in one after another, each rising a little", async () => {
    await renderFeed();
    launcher()!.click();
    const open = await vi.waitUntil(() => composer());

    const parts = [...open.querySelectorAll<HTMLElement>("[data-composer-parts] > *")].filter((part) => getComputedStyle(part).display !== "none");
    expect(parts.length).toBeGreaterThan(2);
    const delays = parts.map((part) => parseFloat(getComputedStyle(part).animationDelay));
    for (const part of parts) expect(getComputedStyle(part).animationName).toBe("composer-part-in");
    // Later parts come later; the last few share the longest wait, so the whole stays short.
    for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays.at(-1)!).toBeLessThanOrEqual(0.2);
  });

  test("left open, it folds back as soon as the posts are scrolled, the box still pinned", async () => {
    await renderFeed();
    launcher()!.click();
    await vi.waitUntil(() => composer());

    await scrollTheFeed(600);

    await vi.waitUntil(() => !composer());
    expect(document.querySelector("[data-composer]")).toHaveAttribute("inert");
    expect(launcher()!.closest<HTMLElement>(".card")!.getBoundingClientRect().top).toBeLessThan(100);
  });

  test("Escape folds it too", async () => {
    await renderFeed();
    launcher()!.click();
    await vi.waitUntil(() => composer());

    await userEvent.keyboard("{Escape}");

    await vi.waitUntil(() => !composer());
  });

  test("folding away keeps what was written; the box offers to go on with it", async () => {
    await renderFeed();
    launcher()!.click();
    await vi.waitUntil(() => composer());
    await userEvent.fill(document.querySelector<HTMLInputElement>('input[aria-label="Tiêu đề"]')!, "Họp tổng kết");

    await scrollTheFeed(600);
    await vi.waitUntil(() => !composer());

    expect(launcher()!.textContent).toBe("Tiếp tục bài đang soạn…");
    launcher()!.click();
    await vi.waitUntil(() => composer());
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Tiêu đề"]')!.value).toBe("Họp tổng kết");
  });

  const emojiPicker = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Chọn biểu tượng cảm xúc"]');
  async function openEmojiPicker() {
    launcher()!.click();
    const open = await vi.waitUntil(() => composer());
    await userEvent.click(open.querySelector<HTMLElement>('button[aria-label="Chèn biểu tượng cảm xúc"]')!);
    await vi.waitUntil(() => emojiPicker());
  }

  test("a popup opened from the composer goes with it when the posts are scrolled", async () => {
    await renderFeed();
    await openEmojiPicker();

    await scrollTheFeed(600);

    await vi.waitUntil(() => !composer());
    await vi.waitUntil(() => !emojiPicker());
  });

  test("scrolling inside a popup of the composer folds neither", async () => {
    await renderFeed();
    await openEmojiPicker();

    emojiPicker()!.dispatchEvent(new WheelEvent("wheel", { deltaY: 300, bubbles: true }));
    await settle();

    expect(composer()).not.toBeNull();
    expect(emojiPicker()).not.toBeNull();
  });

  test("scrolling inside the composer itself does not fold it", async () => {
    await renderFeed();
    launcher()!.click();
    const open = await vi.waitUntil(() => composer());

    open.dispatchEvent(new WheelEvent("wheel", { deltaY: 300, bubbles: true }));
    await settle();

    expect(composer()).not.toBeNull();
  });

  test("with reduced motion it changes at once", async () => {
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) => {
      const result = matchMedia(query);
      if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(result, "matches", { value: true });
      return result;
    });
    await renderFeed();
    // The stylesheet's own query decides; this only checks the rule is there for it.
    const rules = [...document.styleSheets].flatMap((sheet) => { try { return [...sheet.cssRules]; } catch { return []; } });
    const reduced = rules.filter((rule) => rule instanceof CSSMediaRule && rule.conditionText.includes("prefers-reduced-motion"))
      .flatMap((rule) => [...(rule as CSSMediaRule).cssRules].map((inner) => inner.cssText));
    expect(reduced.some((text) => text.includes(".composer-pop") && text.includes("transition: none"))).toBe(true);
  });
});

describe("the new-post box on a phone", () => {
  const launcher = () => [...document.querySelectorAll<HTMLElement>("button")].find((b) => /^(Đăng bài mới…|Tiếp tục bài đang soạn…)$/.test(b.textContent ?? ""));
  const sheet = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Tạo bài viết"]');
  const settle = () => new Promise((resolve) => setTimeout(resolve, 450));

  async function renderFeed() {
    await page.viewport(390, 844);
    serve(30);
    const screen = await render(
      <Provider store={await signedInStore([Permissions.Posts.Create])}>
        <Feed />
      </Provider>,
    );
    await vi.waitUntil(() => shown().includes("Bài số 30"), { timeout: 5000 });
    return screen;
  }
  afterEach(async () => { await page.viewport(1000, 800); });

  test("opens the composer full screen, sliding up, while the feed stays where it was", async () => {
    await renderFeed();
    window.scrollTo(0, 1200);
    await settle();
    const at = window.scrollY;

    launcher()!.click();
    await vi.waitUntil(() => sheet()?.hasAttribute("data-open"));
    await settle();

    const box = sheet()!.getBoundingClientRect();
    expect([box.left, box.top, box.width, box.height]).toEqual([0, 0, window.innerWidth, window.innerHeight]);
    expect(sheet()!.contains(document.querySelector('input[aria-label="Tiêu đề"]'))).toBe(true);
    expect(window.scrollY).toBe(at);
    // The page under it does not scroll.
    expect(getComputedStyle(document.documentElement).overflow).toBe("hidden");
  });

  test("the composer is ready before it is first opened", async () => {
    await renderFeed();
    await vi.waitUntil(() => sheet()?.querySelector('input[aria-label="Tiêu đề"]'), { timeout: 3000 });
    expect(sheet()).not.toHaveAttribute("data-open");
  });

  test("it slides with a transform, not a jump, the very first time too", async () => {
    await renderFeed();
    // There before it is first opened, so the first opening has somewhere to slide from.
    expect(sheet()).not.toBeNull();
    launcher()!.click();
    await vi.waitUntil(() => sheet()?.hasAttribute("data-open"));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(sheet()!.getBoundingClientRect().top).toBeGreaterThan(10);
    const { transitionProperty, transitionDuration } = getComputedStyle(sheet()!);
    expect(transitionProperty).toContain("transform");
    expect(parseFloat(transitionDuration)).toBeGreaterThan(0.1);
  });

  test("closed, it slides away and keeps what was written; the box offers to go on with it", async () => {
    await renderFeed();
    launcher()!.click();
    await vi.waitUntil(() => sheet()?.hasAttribute("data-open"));
    await userEvent.fill(document.querySelector<HTMLInputElement>('input[aria-label="Tiêu đề"]')!, "Họp tổng kết");

    await userEvent.keyboard("{Escape}");
    await vi.waitUntil(() => !sheet()?.hasAttribute("data-open"));
    await settle();

    expect(sheet()!.getBoundingClientRect().top).toBeGreaterThanOrEqual(window.innerHeight - 1);
    expect(getComputedStyle(document.documentElement).overflow).not.toBe("hidden");
    expect(launcher()!.textContent).toBe("Tiếp tục bài đang soạn…");
    launcher()!.click();
    await vi.waitUntil(() => sheet()?.hasAttribute("data-open"));
    expect(document.querySelector<HTMLInputElement>('input[aria-label="Tiêu đề"]')!.value).toBe("Họp tổng kết");
  });
});
