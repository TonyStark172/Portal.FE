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

describe("a mention", () => {
  // Flattens colours as the page would, the last on top, into sRGB.
  const canvas = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
  const flatten = (colors: string[]) => {
    canvas.fillStyle = "#fff";
    canvas.fillRect(0, 0, 1, 1);
    colors.forEach((color) => {
      canvas.fillStyle = color;
      canvas.fillRect(0, 0, 1, 1);
    });
    return [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const luminance = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: number[], b: number[]) => {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (light + 0.05) / (dark + 0.05);
  };

  test("reads at 4.5:1 on its tint in every theme, in a card, the popup and the comment box", async () => {
    await render(<PostContent html='<p><span data-mention-id="1">@Lê Văn Cường</span></p>' />);
    const mention = await vi.waitUntil(() => document.querySelector<HTMLElement>("[data-mention-id]"));
    const html = document.documentElement;
    const before = { theme: html.getAttribute("data-theme"), className: html.className };
    /** What a custom property holds, as a colour the canvas takes. */
    const colorOf = (name: string) => {
      const probe = document.body.appendChild(document.createElement("i"));
      probe.style.backgroundColor = `var(${name})`;
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    };

    try {
      for (const theme of [null, "sky", "lavender", "mint", "netflix", "uber", "mouve", "brutalism", "glass"]) {
        for (const mode of ["light", "dark"]) {
          if (theme) html.setAttribute("data-color-theme", theme);
          else html.removeAttribute("data-color-theme");
          html.setAttribute("data-theme", mode);
          html.className = mode;

          const { color, backgroundColor: tint } = getComputedStyle(mention);
          const page = colorOf("--background");
          const popup = [page, colorOf("--backdrop"), colorOf("--overlay")];
          for (const under of [[page, colorOf("--surface")], popup, [...popup, colorOf("--default")]]) {
            const ratio = contrast(flatten([...under, tint, color]), flatten([...under, tint]));
            expect(ratio, `${theme ?? "default"} ${mode}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    } finally {
      html.removeAttribute("data-color-theme");
      if (before.theme) html.setAttribute("data-theme", before.theme);
      else html.removeAttribute("data-theme");
      html.className = before.className;
    }
  });
});
