import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { ChatMessageDto } from "@/shared/api/generated/portalApi";
import { MessageItem, type MessageItemProps } from "./MessageItem";

afterEach(() => vi.restoreAllMocks());

const message: ChatMessageDto = {
  id: 5,
  conversationId: 1,
  kind: "Text",
  senderId: 2,
  content: "Họp lúc 3 giờ",
  sentAt: "2026-11-24T08:00:00Z",
  editedAt: null,
  isRecalled: false,
  isForwarded: false,
  pinnedAt: null,
  pinnedById: null,
  replyTo: null,
  attachments: [],
  reactions: [],
  systemEvent: null,
  eventNames: [],
  poll: null,
};

async function show(over: Partial<MessageItemProps> = {}) {
  const props: MessageItemProps = {
    message,
    members: [{ userId: 2, fullName: "Lê Bình", avatarUrl: null, isActive: true, lastReadMessageId: 0, isAdmin: false, lastActiveAt: null }],
    isGroup: false,
    isAdmin: false,
    myId: 1,
    startsGroup: true,
    endsGroup: true,
    seenBy: [],
    now: Number.POSITIVE_INFINITY,
    onAction: vi.fn(),
    onReact: vi.fn(),
    onShowReactions: vi.fn(),
    onJumpTo: vi.fn(),
    onVote: vi.fn(async () => {}),
    onAddPollOption: vi.fn(async () => {}),
    onShowPollVotes: vi.fn(),
    ...over,
  };
  // The pointer may be anywhere an earlier test left it: away from where the row will be, which pointing at arms.
  await userEvent.hover(document.documentElement, { position: { x: 5, y: 600 } });
  await render(
    <Provider store={makeStore()}>
      <button type="button">trước</button>
      <MessageItem {...props} />
    </Provider>,
  );
  return props;
}

describe("the actions of a message", () => {
  test("are plain buttons until the row is pointed at, then open the reaction picker and the menu", async () => {
    const props = await show();
    // Nothing of the picker or the menu is built yet.
    expect(document.querySelector("[data-action=more]")?.hasAttribute("aria-haspopup")).toBe(false);

    await page.getByText("Họp lúc 3 giờ").hover();
    await page.getByRole("button", { name: "Bày tỏ cảm xúc" }).click();
    await page.getByRole("button", { name: "Bày tỏ 👍" }).click();
    expect(props.onReact).toHaveBeenCalledWith(message, "👍");

    await page.getByRole("button", { name: "Xem thêm" }).click();
    await page.getByRole("menuitem", { name: "Ghim" }).click();
    expect(props.onAction).toHaveBeenCalledWith("pin", message);
  });

  test("keep the focus on the same action when the keyboard reaches them first", async () => {
    const props = await show();
    await page.getByRole("button", { name: "trước" }).click();
    // The first action of the row.
    await userEvent.keyboard("{Tab}");

    // The plain button that took the focus was replaced by the full one, which has it now.
    await expect.poll(() => (document.activeElement as HTMLElement).getAttribute("data-action")).toBe("react");
    expect(document.querySelector("[data-action=more]")?.hasAttribute("aria-haspopup")).toBe(true);

    await userEvent.keyboard("{Tab}");
    expect((document.activeElement as HTMLElement).getAttribute("data-action")).toBe("reply");
    await userEvent.keyboard("{Enter}");
    expect(props.onAction).toHaveBeenCalledWith("reply", message);
  });

  test("open the reaction picker from the keyboard", async () => {
    await show();
    await page.getByRole("button", { name: "trước" }).click();
    await userEvent.keyboard("{Tab}");
    await expect.poll(() => (document.activeElement as HTMLElement).getAttribute("data-action")).toBe("react");
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("button", { name: "Bày tỏ ❤️" })).toBeVisible();
  });
});
