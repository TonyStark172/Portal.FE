import { describe, expect, test } from "vitest";
import type { ChatMessageDto, ChatMessagePage } from "@/shared/api/generated/portalApi";
import { distinctMessages, mergeLatest, putMessage, reachesLatest, removeMessage, type MessagePages } from "./messagePages";

const message = (id: number, content = `m${id}`) => ({ id, content }) as ChatMessageDto;
const page = (ids: number[], nextBefore: number | null = null, nextAfter: number | null = null): ChatMessagePage => ({
  items: ids.map((id) => message(id)),
  nextBefore,
  nextAfter,
});
const loaded = (...pages: ChatMessagePage[]): MessagePages => ({ pages, pageParams: pages.map(() => null) });
const ids = (data: MessagePages) => distinctMessages(data.pages).map((m) => m.id);

describe("the latest page merged into what a thread has loaded", () => {
  test("adds the new messages in front and replaces the ones it already had", () => {
    const data = loaded(page([10, 9, 8], 8), page([7, 6, 5], 5));
    const latest = page([12, 11, 10], 10);
    latest.items[2] = message(10, "edited");

    expect(mergeLatest(data, latest)).toBe("merged");
    expect(ids(data)).toEqual([12, 11, 10, 9, 8, 7, 6, 5]);
    expect(data.pages[0].items[2].content).toBe("edited");
    // The older pages are as they were: nothing loaded is read again.
    expect(data.pages[1].items.map((m) => m.content)).toEqual(["m7", "m6", "m5"]);
  });

  test("reports a gap when more came in than a page holds, and changes nothing", () => {
    const data = loaded(page([10, 9, 8], 8));
    expect(mergeLatest(data, page([50, 49, 48], 48))).toBe("gap");
    expect(ids(data)).toEqual([10, 9, 8]);
  });

  test("joins when the latest page is the whole conversation, however few it shares with what is loaded", () => {
    const data = loaded(page([3, 2, 1]));
    expect(mergeLatest(data, page([6, 5, 4]))).toBe("merged");
    expect(ids(data)).toEqual([6, 5, 4, 3, 2, 1]);
  });

  test("drops a loaded message the latest page should hold but does not (removed on the reader's side elsewhere)", () => {
    const data = loaded(page([10, 9, 8, 7], 7));
    expect(mergeLatest(data, page([10, 8], 8))).toBe("merged");
    expect(ids(data)).toEqual([10, 8, 7]);
  });

  test("fills an empty thread", () => {
    const data = loaded(page([]));
    mergeLatest(data, page([2, 1]));
    expect(ids(data)).toEqual([2, 1]);
  });
});

describe("one message put in its place", () => {
  test("replaces the loaded one, wherever it is", () => {
    const data = loaded(page([10, 9], 9), page([8, 7]));
    putMessage(data, message(7, "changed"));
    expect(data.pages[1].items[1].content).toBe("changed");
  });

  test("goes first when it is new and the pages reach the latest message", () => {
    const data = loaded(page([10, 9]));
    putMessage(data, message(11));
    expect(ids(data)).toEqual([11, 10, 9]);
  });

  test("is left out of a window further back, which it is not part of", () => {
    const data = loaded(page([10, 9], 9, 10));
    expect(reachesLatest(data)).toBe(false);
    putMessage(data, message(99));
    expect(ids(data)).toEqual([10, 9]);
  });

  test("an older one that is not loaded is not added", () => {
    const data = loaded(page([10, 9], 9));
    putMessage(data, message(3));
    expect(ids(data)).toEqual([10, 9]);
  });
});

test("a message is taken out", () => {
  const data = loaded(page([10, 9, 8]));
  removeMessage(data, 9);
  expect(ids(data)).toEqual([10, 8]);
});
