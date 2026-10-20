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

/** A length custom property as the page resolves it, in px (it may be a calc() of other properties). */
function cssLength(name: string) {
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;height:var(${name})`;
  document.body.append(probe);
  const length = probe.getBoundingClientRect().height;
  probe.remove();
  return length;
}

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
      const top = cssLength("--app-header-height") + cssLength("--app-main-padding");

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
      for (const [x, y] of [[box.left + box.width / 2, cssLength("--app-header-height") + 2], [box.left + 2, box.top + 2]]) {
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

  test("the animation library is not loaded with the page: pointing at the box loads it, and the composer is made then", async () => {
    // The pointer away from where the box will be (a test before may have left it there: the box would load at once).
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } });
    await renderFeed();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    // Only the plain box, as the page came: no animated box, no composer made yet.
    expect(document.querySelector("[data-composer-motion]")).toBeNull();
    expect(document.querySelector("[data-composer]")).toBeNull();
    expect(launcher()).toBeTruthy();

    await userEvent.hover(launcher()!);

    await vi.waitUntil(() => document.querySelector("[data-composer-motion]"), { timeout: 3000 });
    await vi.waitUntil(() => document.querySelector('[data-composer] input[aria-label="Tiêu đề"]'), { timeout: 3000 });
    expect(composer()).toBeNull();
    expect(document.querySelector("[data-composer]")).toHaveAttribute("inert");
  });

  test("a finger touching down on the box (no pointing on a touch screen) starts loading it, before the tap ends", async () => {
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } });
    await renderFeed();
    expect(document.querySelector("[data-composer-motion]")).toBeNull();

    launcher()!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }));

    await vi.waitUntil(() => document.querySelector("[data-composer-motion]"), { timeout: 3000 });
  });

  test("pressed before the animation library has come, it opens as soon as it has", async () => {
    // The pointer away from where the box will be (a test before may have left it there: the box would load at once).
    await userEvent.hover(document.body, { position: { x: 1, y: 1 } });
    await renderFeed();
    expect(document.querySelector("[data-composer-motion]")).toBeNull();

    launcher()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    await vi.waitUntil(() => composer(), { timeout: 4000 });
  });

  test("it opens over the feed where the box is pinned, moving nothing, and takes the focus", async () => {
    await renderFeed();
    // A post, not the composer's own editor (made ahead, hidden, a .post-content too).
    const post = [...document.querySelectorAll<HTMLElement>(".post-content")].find((element) => !element.closest("[data-composer-band]"))!;
    const before = post.getBoundingClientRect().top;

    launcher()!.click();
    const open = await vi.waitUntil(() => composer());
    // The opening is over.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    expect(post.getBoundingClientRect().top).toBe(before);
    expect(open.contains(document.activeElement)).toBe(true);
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
    // Just under the top bar and the page's padding, where the box is pinned.
    expect(box.top).toBeLessThan(cssLength("--app-header-height") + cssLength("--app-main-padding") + 20);
    expect(box.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(window.scrollY).toBeGreaterThan(1000);
  });

  test("opening and closing do not render the composer again, so nothing holds the animation's first frame back", async () => {
    await renderFeed();
    await userEvent.hover(launcher()!);
    await vi.waitUntil(() => document.querySelector('[data-composer] input[aria-label="Tiêu đề"]'), { timeout: 3000 });
    await settle();
    const before = composerRenders.count;

    launcher()!.click();
    await vi.waitUntil(() => composer());
    await userEvent.keyboard("{Escape}");
    await vi.waitUntil(() => !composer());

    expect(composerRenders.count).toBe(before);
  });

  /** The one card that is the box and opens into the composer, and the flying avatar (where it is now). */
  const card = () => document.querySelector<HTMLElement>("[data-composer-card]")!;
  const avatar = () => document.querySelector<HTMLElement>("[data-composer-avatar]")!;
  /** Points at the box, which loads the animation and makes the composer; resolves once both are there. */
  const ready = async () => {
    await userEvent.hover(launcher()!);
    await vi.waitUntil(() => document.querySelector('[data-composer] input[aria-label="Tiêu đề"]'), { timeout: 3000 });
  };
  /**
   * The card's box and the avatar's each time the animation writes a style, for `ms`: every state drawn, however busy
   * the machine (sampling frames would miss some).
   */
  async function sample(ms: number) {
    const frames: { t: number; card: DOMRect; avatar: DOMRect; transformed: boolean }[] = [];
    const start = performance.now();
    const record = () => frames.push({ t: performance.now() - start, card: card().getBoundingClientRect(), avatar: avatar().getBoundingClientRect(), transformed: card().style.transform !== "" && card().style.transform !== "none" });
    const observer = new MutationObserver(record);
    observer.observe(card(), { attributes: true, attributeFilter: ["style"], subtree: true });
    await new Promise((resolve) => setTimeout(resolve, ms));
    observer.disconnect();
    record();
    return frames;
  }

  test("the box itself grows into the composer, on a spring, from where it is, revealing it", async () => {
    await renderFeed();
    await ready();
    const box = card().getBoundingClientRect();

    launcher()!.click();
    const frames = await sample(1400);

    // It starts as the box and grows, in steps, to the whole composer, without moving or widening.
    expect(Math.abs(frames[0].card.height - box.height)).toBeLessThanOrEqual(12);
    const end = frames.at(-1)!.card;
    expect(end.height).toBeGreaterThan(box.height + 150);
    expect(frames.filter((frame) => frame.card.height > box.height + 20 && frame.card.height < end.height - 20).length).toBeGreaterThan(3);
    for (const frame of frames) {
      expect(Math.abs(frame.card.top - box.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(frame.card.width - box.width)).toBeLessThanOrEqual(1);
    }
    // By transform (scaled, its content counter-scaled), not by laying it out again at each step.
    expect(frames.some((frame) => frame.transformed)).toBe(true);
  });

  test("its parts rise in on transform and opacity themselves, which the compositor can run", async () => {
    await renderFeed();
    await ready();
    launcher()!.click();
    const sheet = await vi.waitUntil(() => composer());
    await frames();

    const parts = [...sheet.querySelectorAll<HTMLElement>("[data-composer-parts] > *")];
    const properties = new Set(parts.flatMap((part) => part.getAnimations().flatMap((animation) =>
      (animation.effect as KeyframeEffect).getKeyframes().flatMap((frame) => Object.keys(frame)))));
    expect(properties.has("transform")).toBe(true);
    expect(properties.has("opacity")).toBe(true);
    // Not a CSS variable standing for y, which is not accelerated.
    expect([...properties].filter((name) => name.startsWith("--"))).toEqual([]);
  });

  test("while its parts rise in, the composer shows no scrollbar; once in, it scrolls again", async () => {
    await renderFeed();
    await ready();
    launcher()!.click();
    const sheet = await vi.waitUntil(() => composer());

    await frames();
    expect(getComputedStyle(sheet).overflowY).toBe("hidden");
    await vi.waitUntil(() => getComputedStyle(sheet).overflowY === "auto", { timeout: 2000 });
  });

  test("the avatar flies from the box into the composer's head", async () => {
    await renderFeed();
    await ready();
    await vi.waitUntil(() => Math.round(avatar().getBoundingClientRect().width) === 40);
    const from = avatar().getBoundingClientRect();

    launcher()!.click();
    const frames = await sample(1400);

    const to = frames.at(-1)!.avatar;
    const head = document.querySelector<HTMLElement>("[data-composer-parts] > :first-child .avatar")!.getBoundingClientRect();
    expect(Math.round(from.width)).toBe(40);
    expect(Math.round(to.width)).toBe(Math.round(head.width));
    expect(Math.abs(to.left + to.width / 2 - (head.left + head.width / 2))).toBeLessThanOrEqual(2);
    expect(Math.abs(to.top + to.height / 2 - (head.top + head.height / 2))).toBeLessThanOrEqual(2);
    // Shrinking on the way, not jumping.
    expect(frames.some((frame) => frame.avatar.width > to.width + 1 && frame.avatar.width < from.width - 1)).toBe(true);
  });

  test("the box's line is never stretched while the card grows or shrinks: it blurs and fades away, then comes back", async () => {
    await renderFeed();
    await ready();
    const line = () => [...document.querySelectorAll<HTMLElement>("[data-composer-card] button")].find((b) => /^(Đăng bài mới…|Tiếp tục bài đang soạn…)$/.test(b.textContent ?? ""));
    const rest = line()!.getBoundingClientRect();
    const seen: { height: number; width: number; filter: string }[] = [];
    const observer = new MutationObserver(() => {
      const element = line();
      if (!element) return;
      const box = element.getBoundingClientRect();
      seen.push({ height: box.height, width: box.width, filter: getComputedStyle(element.parentElement!).filter });
    });
    observer.observe(card(), { attributes: true, attributeFilter: ["style"], subtree: true });

    launcher()!.click();
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await userEvent.keyboard("{Escape}");
    await new Promise((resolve) => setTimeout(resolve, 1400));
    observer.disconnect();

    expect(seen.length).toBeGreaterThan(3);
    for (const box of seen) {
      expect(Math.abs(box.height - rest.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - rest.width)).toBeLessThanOrEqual(1);
    }
    expect(seen.some((box) => /blur\(/.test(box.filter))).toBe(true);
  });

  test("closing shrinks it back into the box, the avatar back with it", async () => {
    await renderFeed();
    await ready();
    const box = card().getBoundingClientRect();
    const from = avatar().getBoundingClientRect();
    launcher()!.click();
    await sample(1400);

    // Pressed in the page, at once, so the sampling starts with the closing (a round trip through the test driver could
    // let most of it go by on a busy machine).
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    const frames = await sample(1400);

    expect(composer()).toBeNull();
    const end = frames.at(-1)!;
    expect(Math.abs(end.card.height - box.height)).toBeLessThanOrEqual(1);
    expect(Math.round(end.avatar.width)).toBe(Math.round(from.width));
    expect(frames.some((frame) => frame.card.height > box.height + 20 && frame.card.height < frames[0].card.height - 20)).toBe(true);
  });

  test("open, the band under the top bar is dimmed with the rest, not left as a light strip", async () => {
    await renderFeed();
    await ready();
    const band = document.querySelector<HTMLElement>("[data-composer-band]")!;
    expect(getComputedStyle(band).backgroundImage).not.toBe("none");

    launcher()!.click();
    await vi.waitUntil(() => composer());
    expect(getComputedStyle(band).backgroundImage).toBe("none");

    // Pressed in the page, at once, so the checks below see the closing under way however busy the machine is.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    // Closing: the backdrop is still fading, and so is the band left off.
    await vi.waitUntil(() => !composer());
    const backdrop = document.querySelector<HTMLElement>("[data-composer-backdrop]")!;
    expect(parseFloat(getComputedStyle(backdrop).opacity)).toBeGreaterThan(0);
    expect(getComputedStyle(band).backgroundImage).toBe("none");
    // Once the backdrop is gone, the band is back.
    await vi.waitUntil(() => parseFloat(getComputedStyle(backdrop).opacity) === 0, { timeout: 2000 });
    await vi.waitUntil(() => getComputedStyle(band).backgroundImage !== "none");
  });

  test("a dim backdrop comes behind it; pressing the backdrop closes it", async () => {
    await renderFeed();
    launcher()!.click();
    await vi.waitUntil(() => composer());
    const backdrop = document.querySelector<HTMLElement>("[data-composer-backdrop]")!;
    await vi.waitUntil(() => parseFloat(getComputedStyle(backdrop).opacity) === 1, { timeout: 2000 });

    backdrop.click();

    await vi.waitUntil(() => !composer());
  });

  test("with reduced motion it opens and closes at once", async () => {
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, "matchMedia").mockImplementation((query) => {
      const result = matchMedia(query);
      if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(result, "matches", { value: true });
      return result;
    });
    await renderFeed();
    await ready();
    const box = card().getBoundingClientRect();

    // Two frames after each press it is already where it ends, and stays there.
    launcher()!.click();
    await frames();
    const full = card().getBoundingClientRect().height;
    expect(full).toBeGreaterThan(box.height + 150);
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(Math.abs(card().getBoundingClientRect().height - full)).toBeLessThanOrEqual(1);

    await userEvent.keyboard("{Escape}");
    await frames();
    expect(Math.abs(card().getBoundingClientRect().height - box.height)).toBeLessThanOrEqual(1);
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
    await vi.waitUntil(() => sheet()!.getBoundingClientRect().top === 0, { timeout: 2000 });

    const box = sheet()!.getBoundingClientRect();
    expect([box.left, box.top, box.width, box.height]).toEqual([0, 0, window.innerWidth, window.innerHeight]);
    expect(sheet()!.contains(document.querySelector('input[aria-label="Tiêu đề"]'))).toBe(true);
    expect(window.scrollY).toBe(at);
    // The page under it does not scroll.
    expect(getComputedStyle(document.documentElement).overflow).toBe("hidden");
  });

  test("the composer is made once the box is wanted, before it is opened", async () => {
    await renderFeed();
    await userEvent.hover(launcher()!);
    await vi.waitUntil(() => sheet()?.querySelector('input[aria-label="Tiêu đề"]'), { timeout: 3000 });
    expect(sheet()).not.toHaveAttribute("data-open");
  });

  test("it slides up from below the screen, step by step, the very first time too", async () => {
    await renderFeed();
    await userEvent.hover(launcher()!);
    await vi.waitUntil(() => sheet(), { timeout: 3000 });
    // There before it is first opened, resting below the screen.
    expect(sheet()!.getBoundingClientRect().top).toBeGreaterThanOrEqual(window.innerHeight - 1);
    const tops: number[] = [];
    const transforms: string[] = [];
    const observer = new MutationObserver(() => { tops.push(sheet()!.getBoundingClientRect().top); transforms.push(sheet()!.style.transform); });
    observer.observe(sheet()!, { attributes: true, attributeFilter: ["style"] });

    launcher()!.click();
    await vi.waitUntil(() => sheet()!.getBoundingClientRect().top === 0, { timeout: 2000 });
    observer.disconnect();

    expect(tops.filter((top) => top > 10 && top < window.innerHeight - 10).length).toBeGreaterThan(2);
    // Moved by a transform on the way, so nothing is laid out again.
    expect(transforms.some((transform) => /translateY/.test(transform))).toBe(true);
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
