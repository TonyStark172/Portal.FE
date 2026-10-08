import "@/app/globals.css";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { PostContent } from "./PostContent";

const header = "<tr>" + [1, 2, 3].map((c) => `<th><p>Cột ${c}</p></th>`).join("") + "</tr>";
const body = Array.from({ length: 50 }, (_, r) => "<tr>" + [1, 2, 3].map((c) => `<td><p>${r + 1}.${c}</p></td>`).join("") + "</tr>")
  .join("");

describe("a table on the feed", () => {
  test("taller than 600px scrolls inside the post, its header row staying on top", async () => {
    await render(
      <div className="w-[500px]">
        <PostContent html={`<table><tbody>${header}${body}</tbody></table>`} />
      </div>,
    );
    const wrapper = await vi.waitUntil(() => document.querySelector<HTMLElement>(".post-table"));

    expect(wrapper.clientHeight).toBeLessThanOrEqual(600);
    expect(wrapper.scrollHeight).toBeGreaterThan(wrapper.clientHeight);

    wrapper.scrollTop = 300;
    const th = wrapper.querySelector("th")!;
    await vi.waitFor(() => expect(Math.abs(th.getBoundingClientRect().top - wrapper.getBoundingClientRect().top)).toBeLessThanOrEqual(1));
  });

  test("shorter than 600px shows whole, without a scrollbar", async () => {
    await render(<PostContent html={`<table><tbody>${header}</tbody></table>`} />);
    const wrapper = await vi.waitUntil(() => document.querySelector<HTMLElement>(".post-table"));

    expect(wrapper.scrollHeight).toBe(wrapper.clientHeight);
  });
});
