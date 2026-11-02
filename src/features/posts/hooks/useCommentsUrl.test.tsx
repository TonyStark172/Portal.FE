import { afterEach, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import { historyNavigation } from "./navigation.testing";
import { useCommentsUrl } from "./useCommentsUrl";

vi.mock("next/navigation", () => historyNavigation);

// The test page's own address carries the runner's parameters: kept, with the ones under test added to them.
const start = window.location.href;
const goTo = (query: string) => {
  const url = new URL(start);
  new URLSearchParams(query).forEach((value, name) => url.searchParams.set(name, value));
  window.history.replaceState(null, "", url);
};
/** The parameters of the address that are not the runner's. */
const ours = () => {
  const params = new URLSearchParams(window.location.search);
  new URL(start).searchParams.forEach((_, name) => params.delete(name));
  return params.toString();
};
afterEach(() => window.history.replaceState(null, "", start));

test("open adds ?post and back closes", async () => {
  const { result, act } = await renderHook(() => useCommentsUrl());
  expect(result.current.postId).toBeNull();

  act(() => result.current.open(12));
  expect(result.current.postId).toBe(12);
  expect(ours()).toBe("post=12");

  window.history.back();
  await vi.waitUntil(() => result.current.postId === null);
});

test("close goes back to the feed after an open of this session", async () => {
  const { result, act } = await renderHook(() => useCommentsUrl());

  act(() => result.current.open(12));
  act(() => result.current.close());

  await vi.waitUntil(() => result.current.postId === null);
  expect(ours()).toBe("");
  expect(window.history.state).toBeNull(); // the entry before the open, not the pushed one rewritten
});

test("open leaves the other parts of the address and drops a comment", async () => {
  goTo("tab=a&post=3&comment=9");
  const { result, act } = await renderHook(() => useCommentsUrl());
  expect(result.current).toMatchObject({ postId: 3, commentId: 9 });

  act(() => result.current.open(12));

  expect(ours()).toBe("tab=a&post=12");
  expect(result.current.commentId).toBeNull();
});

test("closing a landed link stays on the page", async () => {
  goTo("tab=a&post=12&comment=45");
  const { result, act } = await renderHook(() => useCommentsUrl());
  expect(result.current).toMatchObject({ postId: 12, commentId: 45 });
  const before = window.history.length;

  act(() => result.current.close());

  expect(result.current).toMatchObject({ postId: null, commentId: null });
  expect(ours()).toBe("tab=a");
  expect(window.history.length).toBe(before);
});

test("ignores a post param that is not a number", async () => {
  goTo("post=abc&comment=1");
  const { result } = await renderHook(() => useCommentsUrl());
  expect(result.current).toMatchObject({ postId: null, commentId: null });
});

test("ignores a comment param that is not a number", async () => {
  goTo("post=12&comment=x");
  const { result } = await renderHook(() => useCommentsUrl());
  expect(result.current).toMatchObject({ postId: 12, commentId: null });
});
