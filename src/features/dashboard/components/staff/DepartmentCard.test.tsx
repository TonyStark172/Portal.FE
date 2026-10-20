import "@/app/globals.css";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { DepartmentCard } from "./DepartmentCard";

const legend = () => [...document.querySelectorAll<HTMLElement>("[data-department-row]")];

afterEach(async () => {
  await page.viewport(1000, 800);
});

describe("the department card", () => {
  test("keeps slices static when reduced motion is requested", async () => {
    const matchMedia = window.matchMedia.bind(window);
    const preference = vi.spyOn(window, "matchMedia").mockImplementation((query) => {
      const result = matchMedia(query);
      if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(result, "matches", { value: true });
      return result;
    });
    const observedPaths = new Set<string>();
    const observer = new MutationObserver(() => {
      const path = document.querySelector(".recharts-pie-sector path")?.getAttribute("d");
      if (path) observedPaths.add(path);
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["d"] });
    try {
      await render(<DepartmentCard headcount={50} departments={{ items: [
        { departmentId: 1, name: "Phòng CNTT", count: 30 },
        { departmentId: 2, name: "Phòng HCNS", count: 20 },
      ], withoutDepartment: 0 }} />);
      const paths = () => [...document.querySelectorAll(".recharts-pie-sector path")].map(p => p.getAttribute("d"));
      await vi.waitFor(() => expect(paths()).toHaveLength(2));
      const initialPaths = paths();
      await new Promise(resolve => setTimeout(resolve, 120));
      expect(paths()).toEqual(initialPaths);
      expect(observedPaths.size).toBe(1);
    } finally {
      observer.disconnect();
      preference.mockRestore();
    }
  });

  test("animates department slices when statistics arrive", async () => {
    // Observe before render: awaiting React's render may already consume entrance frames.
    const paths = new Set<string>();
    const observer = new MutationObserver(() => {
      const path = document.querySelector(".recharts-pie-sector path")?.getAttribute("d");
      if (path) paths.add(path);
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["d"] });
    try {
      await render(<DepartmentCard headcount={50} departments={{ items: [
        { departmentId: 1, name: "Phòng CNTT", count: 30 },
        { departmentId: 2, name: "Phòng HCNS", count: 20 },
      ], withoutDepartment: 0 }} />);
      await vi.waitFor(() => expect(paths.size).toBeGreaterThan(1));
    } finally {
      observer.disconnect();
    }
  });

  test("draws a donut slice per department with its count and share beside it", async () => {
    await render(
      <DepartmentCard
        headcount={50}
        departments={{
          items: [
            { departmentId: 1, name: "Phòng CNTT", count: 30 },
            { departmentId: 2, name: "Phòng HCNS", count: 20 },
          ],
          withoutDepartment: 0,
        }}
      />,
    );

    await vi.waitFor(() => expect(legend().length).toBe(2));
    expect(legend()[0].textContent).toContain("Phòng CNTT");
    expect(legend()[0].textContent).toContain("30");
    expect(legend()[0].textContent).toContain("60%");
    expect(legend()[1].textContent).toContain("40%");
    expect(document.querySelector("[data-donut-total]")?.textContent).toContain("50");
    await vi.waitFor(() => expect(document.querySelectorAll(".recharts-pie-sector").length).toBe(2));
  });

  test("explains shares when someone works in several departments", async () => {
    await render(
      <DepartmentCard
        headcount={2}
        departments={{
          items: [
            { departmentId: 1, name: "Phòng CNTT", count: 2 },
            { departmentId: 2, name: "Ban Giám đốc", count: 1 },
          ],
          withoutDepartment: 0,
        }}
      />,
    );

    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        "Người kiêm nhiệm được tính ở mọi phòng ban họ tham gia, nên tỷ lệ tính trên 3 lượt.",
      ),
    );
  });

  test("says so when nobody works in a department", async () => {
    await render(<DepartmentCard headcount={0} departments={{ items: [], withoutDepartment: 0 }} />);

    await vi.waitFor(() => expect(document.body.textContent).toContain("Chưa có dữ liệu phòng ban."));
    expect(document.querySelector(".recharts-pie")).toBeNull();
  });

  const twoDepartments = { items: [
    { departmentId: 1, name: "Phòng CNTT", count: 30 },
    { departmentId: 2, name: "Phòng HCNS", count: 20 },
  ], withoutDepartment: 0 };
  const names = () => legend().map((row) => row.children[1] as HTMLElement);
  const donut = () => document.querySelector("[data-donut-total]")!.parentElement!.getBoundingClientRect();

  test("in a narrow card on a wide screen, the legend goes under the donut and every name shows", async () => {
    // A desktop with the sidebar open: the screen is wide, the card next to the trend is not (as in the dashboard).
    await page.viewport(1034, 778);
    await render(<div style={{ width: 352 }}><DepartmentCard headcount={50} departments={twoDepartments} /></div>);
    await vi.waitFor(() => expect(legend()).toHaveLength(2));

    for (const name of names()) {
      expect(name.getBoundingClientRect().width).toBeGreaterThan(80);
      expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
    }
    expect(legend()[0].getBoundingClientRect().top).toBeGreaterThan(donut().bottom);
  });

  test("in a wide card, the legend sits beside the donut", async () => {
    await page.viewport(1280, 800);
    await render(<div style={{ width: 640 }}><DepartmentCard headcount={50} departments={twoDepartments} /></div>);
    await vi.waitFor(() => expect(legend()).toHaveLength(2));

    expect(legend()[0].getBoundingClientRect().left).toBeGreaterThan(donut().right);
    expect(names()[0].scrollWidth).toBeLessThanOrEqual(names()[0].clientWidth);
  });

  test("on a phone, lets a long department name wrap to two lines beside its count and share", async () => {
    await page.viewport(390, 844);
    const name = "Phòng Hành chính nhân sự, tổng hợp và quản trị văn phòng";
    await render(
      <DepartmentCard
        headcount={50}
        departments={{
          items: [
            { departmentId: 1, name, count: 30 },
            { departmentId: 2, name: "Phòng CNTT", count: 20 },
          ],
          withoutDepartment: 0,
        }}
      />,
    );

    const label = await vi.waitUntil(() =>
      [...document.querySelectorAll<HTMLElement>("[data-department-row] > span")].find((span) => span.textContent === name),
    );
    const lineHeight = parseFloat(getComputedStyle(label).lineHeight);
    expect(label.scrollHeight).toBeGreaterThan(lineHeight * 1.5);
    expect(label.scrollHeight).toBeLessThanOrEqual(lineHeight * 2 + 1);
    expect(label.getBoundingClientRect().height).toBeGreaterThanOrEqual(label.scrollHeight - 1);
    expect(getComputedStyle(label).textOverflow).not.toBe("ellipsis");
    const row = label.parentElement!;
    const count = row.children[2].getBoundingClientRect();
    expect(count.right).toBeLessThanOrEqual(row.getBoundingClientRect().right + 1);
  });
});
