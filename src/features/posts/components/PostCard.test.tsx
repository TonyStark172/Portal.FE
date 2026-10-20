import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { PostDto } from "@/shared/api/generated/portalApi";
import { hitsAround } from "@/shared/lib/hitArea.testing";
import { PostCard } from "./PostCard";

const HEADER_HEIGHT = 40;
const REACTIONS_HEIGHT = 45;

const post = {
  id: 1,
  kind: "Normal" as PostDto["kind"],
  contentHtml: "<p>Nội dung</p>",
  author: { id: 1, fullName: "Nguyễn Văn An", positionName: "Kỹ sư" } as PostDto["author"],
  createdAt: "2026-10-01T08:00:00Z",
  media: [],
  attachments: [],
  mentions: [],
  mentionsEveryone: false,
  reactions: [
    { kind: "Like", count: 9000 },
    { kind: "Love", count: 1000 },
  ],
  myReaction: null,
  isPinned: false,
  canPin: false,
  canEdit: true,
  canDelete: true,
  version: 1,
} as PostDto;

async function renderPost() {
  return render(
    <Provider store={makeStore()}>
      <PostCard post={post} onEdit={() => {}} />
    </Provider>,
  );
}

beforeEach(async () => {
  await page.viewport(390, 844);
});

afterEach(async () => {
  await page.viewport(1000, 800);
});

describe("a post on a phone", () => {
  test("its small controls take a tap of at least 40px, though they look the same size", async () => {
    await renderPost();
    const options = document.querySelector('[aria-label="Tuỳ chọn bài viết"]')!;
    const react = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Bày tỏ cảm xúc"))!;
    const timestamp = document.querySelector("time")!.parentElement!;
    const summary = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("xem ai đã bày tỏ cảm xúc"))!;

    for (const [name, control] of Object.entries({ options, react, timestamp, summary })) {
      expect(hitsAround(control, 18), name).toBe(true);
    }
  });

  test("the header and the reactions line keep their height", async () => {
    await renderPost();
    const header = document.querySelector('[data-slot="card"] > div')!;
    const reactionsLine = document.querySelector('[data-slot="card"] > div:last-child')!;

    expect(Math.round(header.getBoundingClientRect().height)).toBe(HEADER_HEIGHT);
    expect(Math.round(reactionsLine.getBoundingClientRect().height)).toBe(REACTIONS_HEIGHT);
  });
});
