import "@/app/globals.css";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { OverflowToolbar } from "./OverflowToolbar";

/** A 40px wide tool. */
const tool = (name: string) => (
  <button key={name} type="button" style={{ width: 40, flexShrink: 0 }}>
    {name}
  </button>
);

// Three groups of three tools, with a divider between the groups.
const groups = [
  ["a1", "a2", "a3"].map(tool),
  ["b1", "b2", "b3"].map(tool),
  ["c1", "c2", "c3"].map(tool),
];

const toolbar = () => document.querySelector<HTMLElement>('[role="toolbar"]')!;
/** The tools shown in the row (the ⋮ button has no text). */
const rowTools = () => [...toolbar().querySelectorAll("button")].map((b) => b.textContent).filter((text) => text);
const more = () => toolbar().querySelector<HTMLButtonElement>('[aria-label="Thêm công cụ"]');

describe("a toolbar with more tools than room", () => {
  test("keeps one line and puts the tools that do not fit under ⋮", async () => {
    await render(
      <div style={{ width: 200 }}>
        <OverflowToolbar label="Định dạng" groups={groups} />
      </div>,
    );

    await vi.waitFor(() => expect(more()).not.toBeNull());
    expect(toolbar().getBoundingClientRect().height).toBeLessThanOrEqual(40);
    expect(toolbar().getBoundingClientRect().right).toBeLessThanOrEqual(toolbar().parentElement!.getBoundingClientRect().right);
    const shown = rowTools();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(9);

    more()!.click();
    const popover = await vi.waitUntil(() => document.querySelector('[aria-label="Công cụ khác"]'));
    const hidden = [...popover.querySelectorAll("button")].map((b) => b.textContent);
    // Every tool shows once: in the row, or under ⋮, in order.
    expect([...shown, ...hidden]).toEqual(["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"]);
  });

  test("keeps the tools meant for ⋮ under it even with room, after any that did not fit", async () => {
    await render(
      <div style={{ width: 800 }}>
        <OverflowToolbar label="Định dạng" groups={groups} more={[["m1", "m2"].map(tool)]} />
      </div>,
    );

    await vi.waitFor(() => expect(rowTools()).toEqual(["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"]));
    more()!.click();
    const popover = await vi.waitUntil(() => document.querySelector('[aria-label="Công cụ khác"]'));
    expect([...popover.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["m1", "m2"]);
  });

  test("puts the lower-priority tools under ⋮ first, keeping the row's order", async () => {
    await render(
      <div style={{ width: 240 }}>
        <OverflowToolbar
          label="Định dạng"
          groups={[
            { tools: ["a1", "a2"].map(tool), priority: 2 },
            { tools: ["b1", "b2"].map(tool), priority: 0 },
            { tools: ["c1", "c2"].map(tool), priority: 2 },
          ]}
        />
      </div>,
    );

    // Room for four 40px tools and ⋮: the b group goes, though c comes after it.
    await vi.waitFor(() => expect(rowTools()).toEqual(["a1", "a2", "c1", "c2"]));
    more()!.click();
    const popover = await vi.waitUntil(() => document.querySelector('[aria-label="Công cụ khác"]'));
    expect([...popover.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["b1", "b2"]);
  });

  test("shows every tool and no ⋮ when there is room", async () => {
    await render(
      <div style={{ width: 800 }}>
        <OverflowToolbar label="Định dạng" groups={groups} />
      </div>,
    );

    await vi.waitFor(() => expect(rowTools()).toEqual(["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"]));
    expect(more()).toBeNull();
  });
});
