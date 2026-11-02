import { afterEach, expect, test, vi } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useCommentsLayout } from "./useCommentsLayout";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

test("starts with one column and remembers the other", async () => {
  const first = await renderHook(() => useCommentsLayout());
  expect(first.result.current.layout).toBe("one");

  first.act(() => first.result.current.toggle());
  expect(first.result.current.layout).toBe("two");
  expect(localStorage.getItem("portal.comments.layout")).toBe("two");

  const second = await renderHook(() => useCommentsLayout());
  expect(second.result.current.layout).toBe("two");

  second.act(() => second.result.current.toggle());
  expect(second.result.current.layout).toBe("one");
  expect(localStorage.getItem("portal.comments.layout")).toBe("one");
});

test("ignores a stored value that is not a layout", async () => {
  localStorage.setItem("portal.comments.layout", "three");
  const { result } = await renderHook(() => useCommentsLayout());
  expect(result.current.layout).toBe("one");
});

test("survives blocked storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("blocked", "SecurityError");
  });

  const { result, act } = await renderHook(() => useCommentsLayout());
  expect(result.current.layout).toBe("one");

  act(() => result.current.toggle());
  expect(result.current.layout).toBe("two");
});
