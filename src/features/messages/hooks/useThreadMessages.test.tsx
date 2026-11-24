import { Provider } from "react-redux";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { makeStore } from "@/core/store";
import { portalApi, type ChatMessageDto, type ChatMessagePage } from "@/shared/api/generated/portalApi";
import { emitHubSignal } from "@/shared/realtime/hub";
import { useThreadMessages } from "./useThreadMessages";

afterEach(() => vi.restoreAllMocks());

const message = (id: number, content = `m${id}`) => ({ id, content, kind: "Text" }) as ChatMessageDto;
const pageOf = (ids: number[], nextBefore: number | null = null, nextAfter: number | null = null): ChatMessagePage => ({
  items: ids.map((id) => message(id)),
  nextBefore,
  nextAfter,
});

/** What the thread shows, as text a test can read, with the two things a reader can do to move in it. */
function Harness() {
  const thread = useThreadMessages(7, undefined);
  return (
    <div>
      <p data-testid="messages">{thread.messages.map((m) => `${m.id}:${m.content}`).join(" ")}</p>
      <p data-testid="around">{String(thread.around)}</p>
      <button type="button" onClick={() => thread.showAround(500)}>around 500</button>
      <button type="button" onClick={() => void thread.goToLatest()}>latest</button>
    </div>
  );
}

/** Serves the conversation's messages from `answers` (by query string, without the page size) and records what was asked. */
async function open(answers: Record<string, () => ChatMessagePage | ChatMessageDto | null>) {
  const asked: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const path = url.pathname.replace(/^.*\/api\/Conversations/, "");
    url.searchParams.delete("pageSize");
    const key = `${path}${url.search}`;
    asked.push(key);
    const answer = answers[key]?.();
    return answer ? Response.json(answer) : new Response(null, { status: 404 });
  });
  const store = makeStore();
  await render(
    <Provider store={store}>
      <Harness />
    </Provider>,
  );
  return { asked, store };
}

const shown = () => page.getByTestId("messages");

describe("the messages of an open thread", () => {
  test("take a new message in with one read of the latest page, whatever else is read again at that moment", async () => {
    let latest = pageOf([3, 2, 1]);
    const { asked, store } = await open({ "/7/messages": () => latest });
    await expect.element(shown()).toHaveTextContent("3:m3 2:m2 1:m1");

    latest = pageOf([4, 3, 2, 1]);
    // As the hub does it: the thread hears the signal, then the lists and details of conversations are invalidated.
    emitHubSignal({ kind: "Messages", broadcast: false, conversationId: 7, messageId: 4 });
    store.dispatch(portalApi.util.invalidateTags(["Conversations"]));

    await expect.element(shown()).toHaveTextContent("4:m4 3:m3 2:m2 1:m1");
    expect(asked.filter((key) => key === "/7/messages")).toHaveLength(2);
  });

  test("read a changed message by itself when it is loaded but further back than the latest page", async () => {
    let latest = pageOf([30, 29, 5], 5);
    let old = message(5);
    const { asked } = await open({
      "/7/messages": () => latest,
      "/messages/5": () => old,
      "/messages/1": () => message(1),
    });
    await expect.element(shown()).toHaveTextContent("30:m30 29:m29 5:m5");

    // By now the latest page no longer reaches back to it.
    latest = pageOf([31, 30, 29], 29);
    old = message(5, "edited");
    emitHubSignal({ kind: "Messages", broadcast: false, conversationId: 7, messageId: 5 });
    await expect.element(shown()).toHaveTextContent("31:m31 30:m30 29:m29 5:edited");
    expect(asked.filter((key) => key === "/messages/5")).toHaveLength(1);

    // One that is not loaded at all is nobody's business here.
    emitHubSignal({ kind: "Messages", broadcast: false, conversationId: 7, messageId: 1 });
    await vi.waitUntil(() => asked.filter((key) => key === "/7/messages").length === 3);
    expect(asked).not.toContain("/messages/1");
  });

  test("ignore signals of other conversations and those that say nothing changed in the messages", async () => {
    const { asked } = await open({ "/7/messages": () => pageOf([3, 2, 1]) });
    await expect.element(shown()).toHaveTextContent("3:m3");

    emitHubSignal({ kind: "Messages", broadcast: false, conversationId: 8, messageId: 9 });
    emitHubSignal({ kind: "Messages", broadcast: false, conversationId: 7 });
    emitHubSignal({ kind: "Typing", broadcast: false, conversationId: 7, userId: 2 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(asked).toEqual(["/7/messages"]);
  });

  test("read the latest page again when signals may have been missed", async () => {
    let latest = pageOf([3, 2, 1]);
    await open({ "/7/messages": () => latest });
    await expect.element(shown()).toHaveTextContent("3:m3");

    latest = pageOf([5, 4, 3, 2, 1]);
    emitHubSignal({ kind: "Resync", broadcast: false });
    await expect.element(shown()).toHaveTextContent("5:m5 4:m4 3:m3 2:m2 1:m1");
  });

  test("show the messages around one that is not loaded, in one read, and go back to the latest", async () => {
    const { asked } = await open({
      "/7/messages": () => pageOf([900, 899], 899),
      "/7/messages?around=500": () => pageOf([501, 500, 499], 499, 501),
    });
    await expect.element(shown()).toHaveTextContent("900:m900 899:m899");

    await page.getByRole("button", { name: "around 500" }).click();
    await expect.element(shown()).toHaveTextContent("501:m501 500:m500 499:m499");
    await expect.element(page.getByTestId("around")).toHaveTextContent("500");
    expect(asked).toContain("/7/messages?around=500");

    // A new message while in the window is not part of it.
    emitHubSignal({ kind: "Messages", broadcast: false, conversationId: 7, messageId: 901 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect.element(shown()).toHaveTextContent("501:m501 500:m500 499:m499");

    await page.getByRole("button", { name: "latest" }).click();
    await expect.element(shown()).toHaveTextContent("900:m900 899:m899");
    await expect.element(page.getByTestId("around")).toHaveTextContent("null");
  });
});
