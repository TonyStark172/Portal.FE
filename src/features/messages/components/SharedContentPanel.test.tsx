import "@/app/globals.css";
import { useState } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { ConversationDto, SharedChatItemPage } from "@/shared/api/generated/portalApi";
import { SharedContentPanel, type SharedTab } from "./SharedContentPanel";

afterEach(() => vi.restoreAllMocks());

const conversation: ConversationDto = {
  id: 7,
  isGroup: true,
  name: "Dự án",
  members: [{ userId: 2, fullName: "Lê Bình", avatarUrl: null, isActive: true, lastReadMessageId: 0, isAdmin: false, lastActiveAt: null }],
  lastMessage: null,
  unreadCount: 0,
  lastReadMessageId: 0,
  lastMessageAt: null,
  isMuted: false,
  isAdmin: true,
};

const sentAt = "2026-11-20T08:00:00Z";
const pages: Record<string, SharedChatItemPage> = {
  Media: {
    items: [
      { messageId: 31, senderId: 2, sentAt, url: null, attachment: { id: "a1", kind: "Image", fileName: "anh.png", contentType: "image/png", size: 10, width: 800, height: 600 } },
      { messageId: 31, senderId: 2, sentAt, url: null, attachment: { id: "a2", kind: "Video", fileName: "clip.mp4", contentType: "video/mp4", size: 20, width: null, height: null } },
    ],
    nextBefore: null,
  },
  Files: {
    items: [
      { messageId: 30, senderId: 1, sentAt, url: null, attachment: { id: "f1", kind: "Attachment", fileName: "bao-cao.pdf", contentType: "application/pdf", size: 2048, width: null, height: null } },
    ],
    nextBefore: null,
  },
  Links: { items: [], nextBefore: null },
};

async function open(initial: SharedTab) {
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    const kind = new URL(url, location.href).searchParams.get("kind");
    if (url.includes("/api/Conversations/7/shared") && kind) return Response.json(pages[kind]);
    return new Response(null, { status: 404 });
  });
  const onJumpTo = vi.fn();
  function Harness() {
    const [tab, setTab] = useState<SharedTab>(initial);
    return (
      <SharedContentPanel conversation={conversation} myId={1} tab={tab} onTab={setTab} onJumpTo={onJumpTo} onBack={() => {}} onClose={() => {}} />
    );
  }
  await render(
    <Provider store={makeStore()}>
      <Harness />
    </Provider>,
  );
  return onJumpTo;
}

describe("what was shared in a conversation", () => {
  test("shows photos and videos as tiles, each one shown in the chat on request", async () => {
    const onJumpTo = await open("media");
    await expect.element(page.getByRole("button", { name: "Xem ảnh anh.png" })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Phát video clip.mp4" })).toBeVisible();
    await page.getByRole("button", { name: "Xem trong đoạn chat" }).first().click();
    expect(onJumpTo).toHaveBeenCalledWith(31);
  });

  test("lists the files with their size and who sent them, under their own tab", async () => {
    await open("media");
    await page.getByRole("tab", { name: "File" }).click();
    await expect.element(page.getByText("bao-cao.pdf")).toBeVisible();
    await expect.element(page.getByText(/2 KB · Bạn/)).toBeVisible();
    expect(page.getByRole("button", { name: "Xem ảnh anh.png" }).query()).toBeNull();
  });

  test("says so when nothing of a kind was shared", async () => {
    await open("links");
    await expect.element(page.getByText("Chưa có liên kết nào.")).toBeVisible();
  });
});

describe("the links shared in a conversation", () => {
  test("open in a new tab, named by their site", async () => {
    pages.Links = {
      items: [{ messageId: 40, senderId: 2, sentAt, attachment: null, url: "https://www.example.com/tai-lieu?id=1" }],
      nextBefore: null,
    };
    const onJumpTo = await open("links");
    const link = page.getByRole("link", { name: /example\.com/ });
    await expect.element(link).toHaveAttribute("href", "https://www.example.com/tai-lieu?id=1");
    await expect.element(link).toHaveAttribute("target", "_blank");
    await expect.element(page.getByText("Lê Bình", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Xem trong đoạn chat" }).click();
    expect(onJumpTo).toHaveBeenCalledWith(40);
  });
});
