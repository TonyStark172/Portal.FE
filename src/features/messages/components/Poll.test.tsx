import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { makeStore } from "@/core/store";
import type { ChatMessageDto, ChatPollDto, ConversationMemberDto } from "@/shared/api/generated/portalApi";
import { CreatePollDialog } from "./CreatePollDialog";
import { PollCard } from "./PollCard";

afterEach(() => vi.restoreAllMocks());

const members: ConversationMemberDto[] = [
  { userId: 2, fullName: "Lê Bình", avatarUrl: null, isActive: true, lastReadMessageId: 0, isAdmin: false, lastActiveAt: null },
];

function pollMessage(poll: Partial<ChatPollDto> = {}, senderId = 2): ChatMessageDto {
  return {
    id: 9,
    conversationId: 1,
    kind: "Poll",
    senderId,
    content: "Trưa nay ăn gì?",
    sentAt: "2026-11-24T04:00:00Z",
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
    poll: {
      allowsMultipleChoices: false,
      allowsNewOptions: true,
      endsAt: null,
      closedAt: null,
      options: [
        { id: 1, text: "Phở", addedById: 2, voterIds: [2] },
        { id: 2, text: "Cơm", addedById: 2, voterIds: [] },
      ],
      ...poll,
    },
  };
}

const NOW = Date.parse("2026-11-24T08:00:00Z");

async function showPoll(message: ChatMessageDto, now = NOW) {
  const onVote = vi.fn(async () => {});
  const onAddOption = vi.fn(async () => {});
  const onShowVotes = vi.fn();
  await render(
    <Provider store={makeStore()}>
      <PollCard message={message} members={members} myId={1} now={now} onVote={onVote} onAddOption={onAddOption} onShowVotes={onShowVotes} />
    </Provider>,
  );
  return { onVote, onAddOption, onShowVotes };
}

describe("a poll in the conversation", () => {
  test("shows each option with its votes and who voted", async () => {
    const { onShowVotes } = await showPoll(pollMessage());
    await expect.element(page.getByText("Trưa nay ăn gì?")).toBeVisible();
    await expect.element(page.getByText("Chọn một phương án")).toBeVisible();
    await expect.element(page.getByRole("radio", { name: "Phở: 1 phiếu" })).toHaveAttribute("aria-checked", "false");
    await expect.element(page.getByText("1 người đã bình chọn")).toBeVisible();
    await page.getByRole("button", { name: "Xem bình chọn" }).click();
    expect(onShowVotes).toHaveBeenCalled();
  });

  test("moves a single vote, and pressing the reader's own option takes it back", async () => {
    const { onVote } = await showPoll(pollMessage());
    await page.getByRole("radio", { name: /Cơm/ }).click();
    expect(onVote).toHaveBeenLastCalledWith(expect.objectContaining({ id: 9 }), [2]);

    const voted = pollMessage({ options: [{ id: 1, text: "Phở", addedById: 2, voterIds: [2] }, { id: 2, text: "Cơm", addedById: 2, voterIds: [1] }] });
    const second = await showPoll(voted);
    await page.getByRole("radio", { name: /Cơm/ }).last().click();
    expect(second.onVote).toHaveBeenLastCalledWith(expect.objectContaining({ id: 9 }), []);
  });

  test("adds to the reader's votes when several are allowed", async () => {
    const message = pollMessage({ allowsMultipleChoices: true, options: [{ id: 1, text: "Phở", addedById: 2, voterIds: [1] }, { id: 2, text: "Cơm", addedById: 2, voterIds: [] }] });
    const { onVote } = await showPoll(message);
    await expect.element(page.getByText("Chọn một hoặc nhiều phương án")).toBeVisible();
    await page.getByRole("checkbox", { name: /Cơm/ }).click();
    expect(onVote).toHaveBeenLastCalledWith(expect.objectContaining({ id: 9 }), [1, 2]);
  });

  test("takes a new option when allowed", async () => {
    const { onAddOption } = await showPoll(pollMessage());
    await page.getByRole("button", { name: "Thêm phương án" }).click();
    await userEvent.keyboard("Bún chả{Enter}");
    expect(onAddOption).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }), "Bún chả");
  });

  test("offers no new option to others when only its creator may add them", async () => {
    await showPoll(pollMessage({ allowsNewOptions: false }));
    await expect.element(page.getByText("Trưa nay ăn gì?")).toBeVisible();
    expect(page.getByRole("button", { name: "Thêm phương án" }).query()).toBeNull();
  });

  test("counts down to its deadline", async () => {
    await showPoll(pollMessage({ endsAt: new Date(NOW + 2 * 3_600_000 + 15 * 60_000).toISOString() }));
    await expect.element(page.getByText("Còn 2 giờ 15 phút")).toHaveAttribute("title", expect.stringMatching(/^Kết thúc lúc \d/));
    await expect.element(page.getByRole("radio", { name: /Cơm/ })).toBeEnabled();
  });

  test("ends by itself once its deadline has passed", async () => {
    const endsAt = new Date(NOW - 60_000).toISOString();
    await showPoll(pollMessage({ endsAt }));
    // The state in the corner says it is over; when, on hover.
    await expect.element(page.getByText("Đã kết thúc", { exact: true })).toHaveAttribute("title", expect.stringMatching(/^Đã kết thúc lúc \d/));
    expect(page.getByText(/^Còn /).query()).toBeNull();
    await expect.element(page.getByRole("radio", { name: /Phở/ })).toBeDisabled();
    expect(page.getByRole("button", { name: "Thêm phương án" }).query()).toBeNull();
  });

  test("is ended: marked so, no more votes or options", async () => {
    await showPoll(pollMessage({ closedAt: "2026-11-24T05:00:00Z" }));
    await expect.element(page.getByText("Đã kết thúc")).toBeVisible();
    await expect.element(page.getByRole("radio", { name: /Phở/ })).toBeDisabled();
    expect(page.getByRole("button", { name: "Thêm phương án" }).query()).toBeNull();
  });
});

describe("creating a poll", () => {
  test("needs a question and two different options, then sends them with the choices made", async () => {
    const sent: unknown[] = [];
    vi.spyOn(window, "fetch").mockImplementation(async (input) => {
      if (input instanceof Request && input.method === "POST" && input.url.endsWith("/api/Conversations/5/polls")) {
        sent.push(await input.clone().json());
        return Response.json(pollMessage());
      }
      return new Response(null, { status: 404 });
    });
    const onCreated = vi.fn();
    await render(
      <Provider store={makeStore()}>
        <CreatePollDialog conversationId={5} isOpen onClose={() => {}} onCreated={onCreated} />
      </Provider>,
    );

    const submit = page.getByRole("button", { name: "Tạo bình chọn" });
    await page.getByRole("textbox", { name: "Câu hỏi" }).fill("Trưa nay ăn gì?");
    await page.getByRole("textbox", { name: "Phương án 1" }).fill("Phở");
    await expect.element(submit).toBeDisabled();
    await page.getByRole("textbox", { name: "Phương án 2" }).fill("phở");
    await expect.element(page.getByText("Hai phương án trùng nhau.")).toBeVisible();
    await expect.element(submit).toBeDisabled();

    await page.getByRole("textbox", { name: "Phương án 2" }).fill("Cơm");
    await page.getByRole("button", { name: "Thêm phương án" }).click();
    await page.getByText("Cho phép chọn nhiều phương án").click();
    await submit.click();

    await vi.waitUntil(() => onCreated.mock.calls.length > 0);
    // The empty third option is left out; no deadline unless one is chosen.
    expect(sent).toEqual([{ question: "Trưa nay ăn gì?", options: ["Phở", "Cơm"], allowsMultipleChoices: false, allowsNewOptions: true, endsAt: null }]);
  });

  test("sends the deadline chosen, counted from when it is sent", async () => {
    const sent: { endsAt: string }[] = [];
    vi.spyOn(window, "fetch").mockImplementation(async (input) => {
      if (input instanceof Request && input.method === "POST" && input.url.endsWith("/api/Conversations/5/polls")) {
        sent.push(await input.clone().json());
        return Response.json(pollMessage());
      }
      return new Response(null, { status: 404 });
    });
    const onCreated = vi.fn();
    await render(
      <Provider store={makeStore()}>
        <CreatePollDialog conversationId={5} isOpen onClose={() => {}} onCreated={onCreated} />
      </Provider>,
    );
    await page.getByRole("textbox", { name: "Câu hỏi" }).fill("Họp lúc mấy giờ?");
    await page.getByRole("textbox", { name: "Phương án 1" }).fill("9 giờ");
    await page.getByRole("textbox", { name: "Phương án 2" }).fill("14 giờ");
    // Off by default; turned on, it offers a day first.
    expect(page.getByRole("button", { name: /Kết thúc sau/ }).query()).toBeNull();
    await page.getByText("Giới hạn thời gian bình chọn").click();
    await expect.element(page.getByRole("button", { name: /Kết thúc sau/ })).toHaveTextContent(/1 ngày/);
    await page.getByRole("button", { name: /Kết thúc sau/ }).click();
    for (const name of ["1 giờ", "3 giờ", "8 giờ", "1 ngày", "3 ngày", "Khác"]) {
      await expect.element(page.getByRole("option", { name })).toBeVisible();
    }
    await page.getByRole("option", { name: "8 giờ" }).click();
    const before = Date.now();
    await page.getByRole("button", { name: "Tạo bình chọn" }).click();

    await vi.waitUntil(() => onCreated.mock.calls.length > 0);
    const left = Date.parse(sent[0].endsAt) - before;
    expect(left).toBeGreaterThanOrEqual(8 * 3_600_000 - 1_000);
    expect(left).toBeLessThanOrEqual(8 * 3_600_000 + 5_000);
  });
});
