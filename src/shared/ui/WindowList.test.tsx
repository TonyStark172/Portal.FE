import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { WindowList } from "./WindowList";

type Item = { id: number; height: number };

const items = (count: number, height = (i: number) => 150 + (i % 4) * 50): Item[] =>
  Array.from({ length: count }, (_, i) => ({ id: i, height: height(i) }));

function List({ data }: { data: Item[] }) {
  return (
    <WindowList
      items={data}
      getKey={(item) => item.id}
      gap={16}
      renderItem={(item) => (
        <article data-item={item.id} style={{ height: item.height }}>
          Bài {item.id}
        </article>
      )}
    />
  );
}

const rendered = () => [...document.querySelectorAll<HTMLElement>("[data-item]")];
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

afterEach(() => window.scrollTo(0, 0));

describe("a list scrolling with the page", () => {
  test("keeps only the items near the viewport in the page, however many there are", async () => {
    await render(<List data={items(1000)} />);

    await vi.waitUntil(() => rendered().length > 0);
    expect(rendered().length).toBeLessThan(30);
    // The page is still as tall as every item, so the scrollbar shows the whole list.
    expect(document.documentElement.scrollHeight).toBeGreaterThan(1000 * 150);
  });

  test("shows the last item when scrolled to the end", async () => {
    await render(<List data={items(1000)} />);
    await vi.waitUntil(() => rendered().length > 0);

    // Heights are measured as items render, so the end moves a little: keep going until it stops.
    await vi.waitFor(
      async () => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        await nextFrame();
        expect(rendered().map((el) => el.dataset.item)).toContain("999");
      },
      { timeout: 3000 },
    );
    expect(rendered().length).toBeLessThan(30);
  });

  test("lays items of different heights one under the other, the gap between them", async () => {
    await render(<List data={items(50, (i) => (i % 2 ? 320 : 90))} />);
    await vi.waitUntil(() => rendered().length > 1);
    window.scrollTo(0, 2000);

    await vi.waitFor(() => {
      const boxes = rendered()
        .map((el) => el.getBoundingClientRect())
        .sort((a, b) => a.top - b.top);
      expect(boxes.length).toBeGreaterThan(1);
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].top - boxes[i - 1].bottom).toBeCloseTo(16, 0);
    });
  });
});
