import "@/app/globals.css";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { DepartmentCard } from "./DepartmentCard";

const legend = () => [...document.querySelectorAll<HTMLElement>("[data-department-row]")];

describe("the department card", () => {
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
});
