import "@/app/globals.css";
import { Button } from "@heroui/react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { ChatMessageDto, ChatReactorDto } from "@/shared/api/generated/portalApi";
import { ReactionPopover } from "./ReactionPopover";
import { ReactionsDialog } from "./ReactionsDialog";

afterEach(() => vi.restoreAllMocks());

async function openPopover(myReaction: string | null) {
  const onPick = vi.fn();
  await render(
    <ReactionPopover placement="top end" myReaction={myReaction} onPick={onPick} trigger={<Button>Mở</Button>} />,
  );
  await page.getByRole("button", { name: "Mở" }).click();
  return onPick;
}

describe("the reaction picker of a message", () => {
  test("opens on its button with the six quick reactions and a way to more", async () => {
    await openPopover(null);
    for (const emoji of ["👍", "❤️", "😆", "😮", "😢", "😠"]) {
      await expect.element(page.getByRole("button", { name: `Bày tỏ ${emoji}` })).toBeVisible();
    }
    await expect.element(page.getByRole("button", { name: "Cảm xúc khác" })).toBeVisible();
  });

  test("picks an emoji, and picking the reader's own again removes it", async () => {
    const onPick = await openPopover("❤️");
    await expect.element(page.getByRole("button", { name: "Bày tỏ ❤️" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Bày tỏ ❤️" }).click();
    expect(onPick).toHaveBeenLastCalledWith(null);

    await page.getByRole("button", { name: "Mở" }).click();
    await page.getByRole("button", { name: "Bày tỏ 😮" }).click();
    expect(onPick).toHaveBeenLastCalledWith("😮");
  });

  test("shows the reader's own reaction in the row when it is not a quick one", async () => {
    await openPopover("🎉");
    await expect.element(page.getByRole("button", { name: "Bày tỏ 🎉" })).toHaveAttribute("aria-pressed", "true");
  });

  test("turns into the full emoji picker with the plus", async () => {
    await openPopover(null);
    await page.getByRole("button", { name: "Cảm xúc khác" }).click();
    await expect.element(page.getByRole("searchbox", { name: "Tìm biểu tượng cảm xúc" })).toBeVisible();
  });
});

const message = {
  id: 5,
  conversationId: 1,
  kind: "Text",
  senderId: 1,
  content: "Họp lúc 3 giờ",
  sentAt: "2026-11-24T08:00:00Z",
  editedAt: null,
  isRecalled: false,
  isForwarded: false,
  pinnedAt: null,
  pinnedById: null,
  replyTo: null,
  attachments: [],
  reactions: [
    { emoji: "❤️", userIds: [2, 1] },
    { emoji: "👍", userIds: [3] },
  ],
  systemEvent: null,
  eventNames: [],
  poll: null,
} satisfies ChatMessageDto;

const reactors: ChatReactorDto[] = [
  { userId: 1, fullName: "Trần Lan", avatarUrl: null, emoji: "❤️", reactedAt: "2026-11-24T08:03:00Z" },
  { userId: 3, fullName: "Ngô Chi", avatarUrl: null, emoji: "👍", reactedAt: "2026-11-24T08:02:00Z" },
  { userId: 2, fullName: "Lê Bình", avatarUrl: null, emoji: "❤️", reactedAt: "2026-11-24T08:01:00Z" },
];

async function openDialog() {
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    if (input instanceof Request && input.url.endsWith("/api/Conversations/messages/5/reactions")) {
      return Response.json(reactors);
    }
    return new Response(null, { status: 404 });
  });
  const onRemoveMine = vi.fn();
  await render(
    <Provider store={makeStore()}>
      <ReactionsDialog message={message} myId={1} onRemoveMine={onRemoveMine} onClose={() => {}} />
    </Provider>,
  );
  return onRemoveMine;
}

describe("the list of who reacted to a message", () => {
  test("names everyone with their emoji, under a tab per emoji with its count", async () => {
    await openDialog();
    await expect.element(page.getByRole("heading", { name: "Cảm xúc về tin nhắn" })).toBeVisible();
    await expect.element(page.getByRole("tab", { name: "Tất cả 3" })).toBeVisible();
    await expect.element(page.getByRole("tab", { name: "❤️: 2" })).toBeVisible();
    for (const name of ["Trần Lan", "Ngô Chi", "Lê Bình"]) await expect.element(page.getByText(name)).toBeVisible();

    await page.getByRole("tab", { name: "👍: 1" }).click();
    await expect.element(page.getByText("Ngô Chi")).toBeVisible();
    expect(page.getByText("Lê Bình").query()).toBeNull();
  });

  test("removes the reader's own reaction from their row", async () => {
    const onRemoveMine = await openDialog();
    await page.getByRole("button", { name: /Trần Lan.*Nhấn để gỡ/ }).click();
    expect(onRemoveMine).toHaveBeenCalledWith(message);
    // The others' rows are not buttons.
    expect(page.getByRole("button", { name: /Lê Bình/ }).query()).toBeNull();
  });
});
