import { useCallback, useState } from "react";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { usePagedAudienceSuggestions } from "./usePagedAudienceSuggestions";

test("new search never exposes old actionable items even before its reset timer runs", async () => {
  const renders: Array<{ query: string; keys: string[] }> = [];
  function Harness() {
    const [query, setQuery] = useState("old");
    const load = useCallback(async () => ({ items: [{ key: query }], hasMore: false }), [query]);
    const result = usePagedAudienceSuggestions(true, load);
    renders.push({ query, keys: result.items.map(item => item.key) });
    return <><button onClick={() => setQuery("fresh")}>New search</button><output>{result.items.map(item => item.key).join(",")}</output></>;
  }
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("status")).toHaveTextContent("old");
  await userEvent.click(screen.getByRole("button", { name: "New search" }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("fresh");
  expect(renders.filter(item => item.query === "fresh").some(item => item.keys.includes("old"))).toBe(false);
});

test("overlapping pages deduplicate IDs and the final page cannot load again", async () => {
  const load = vi.fn(async (page: number) => ({ items: page === 1 ? [{ key: "a" }, { key: "b" }] : [{ key: "b" }, { key: "c" }], hasMore: page === 1 }));
  function Harness() {
    const result = usePagedAudienceSuggestions(true, load);
    return <><button onClick={result.loadMore}>More</button><output>{result.items.map(item => item.key).join(",")}</output></>;
  }
  const screen = await render(<Harness />);
  await expect.element(screen.getByRole("status")).toHaveTextContent("a,b");
  await userEvent.click(screen.getByRole("button", { name: "More" }));
  await expect.element(screen.getByRole("status")).toHaveTextContent("a,b,c");
  await userEvent.click(screen.getByRole("button", { name: "More" }));
  expect(load.mock.calls.map(call => call[0])).toEqual([1, 2]);
});

test("unmount aborts an in-flight page even when its fetcher ignores abort", async () => {
  let signal: AbortSignal | undefined;
  let finish!: (page: { items: { key: string }[]; hasMore: boolean }) => void;
  const load = vi.fn((_page: number, current: AbortSignal) => {
    signal = current;
    return new Promise<{ items: { key: string }[]; hasMore: boolean }>(resolve => { finish = resolve; });
  });
  function Harness() { usePagedAudienceSuggestions(true, load); return <span>Picker</span>; }
  const screen = await render(<Harness />);
  await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
  await screen.unmount();
  expect(signal?.aborted).toBe(true);
  finish({ items: [{ key: "late" }], hasMore: false });
});
