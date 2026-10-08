import "@/app/globals.css";
import { Provider } from "react-redux";
import { describe, expect, test, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { PaginatedListOfStaffEmployeeDto } from "@/shared/api/generated/portalApi";
import { EmployeesTable } from "./EmployeesTable";

const page = (overrides: Partial<PaginatedListOfStaffEmployeeDto> = {}): PaginatedListOfStaffEmployeeDto => ({
  pageNumber: 1,
  totalPages: 3,
  totalCount: 25,
  hasPreviousPage: false,
  hasNextPage: true,
  items: [
    {
      userId: 1,
      employeeCode: "00003",
      fullName: "Nguyễn Văn An",
      email: "an.nv@portal.local",
      avatarUrl: null,
      positionName: "Trưởng phòng",
      departmentName: "Phòng CNTT",
      dateOfBirth: "1990-05-20",
      seniorityDays: 400,
    },
    {
      userId: 2,
      employeeCode: "00004",
      fullName: "Mai Văn Minh",
      email: null,
      avatarUrl: null,
      positionName: null,
      departmentName: null,
      dateOfBirth: null,
      seniorityDays: null,
    },
  ],
  ...overrides,
});

const rows = () => [...document.querySelectorAll<HTMLElement>('tbody [role="row"], tbody tr')];
const button = (name: string) =>
  [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === name || b.getAttribute("aria-label") === name);

function renderTable(props: Partial<Parameters<typeof EmployeesTable>[0]> = {}) {
  return render(
    <Provider store={makeStore()}>
      <EmployeesTable
        page={page()}
        sort={{ column: "EmployeeCode", direction: "ascending" }}
        onSortChange={vi.fn()}
        onPageChange={vi.fn()}
        {...props}
      />
    </Provider>,
  );
}

describe("the employees table", () => {
  test("shows code, name with email, position, date of birth and seniority", async () => {
    await renderTable();

    await vi.waitFor(() => expect(rows().length).toBe(2));
    const headers = [...document.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent?.trim());
    expect(headers).toEqual(["Mã nhân sự", "Họ và tên", "Vị trí", "Ngày sinh", "Thâm niên"]);
    const [an, minh] = rows().map((r) => r.textContent ?? "");
    expect(an).toContain("00003");
    expect(an).toContain("Nguyễn Văn An");
    expect(an).toContain("an.nv@portal.local");
    expect(an).toContain("Trưởng phòng");
    expect(an).toContain("Phòng CNTT");
    expect(an).toContain("20/05/1990");
    expect(an).toContain("1 năm 1 tháng");
    expect(minh).toContain("Chưa có vị trí");
    expect(minh).toContain("—");
  });

  test("sorts by the column header pressed", async () => {
    const onSortChange = vi.fn();
    await renderTable({ onSortChange });

    const header = await vi.waitUntil(() =>
      [...document.querySelectorAll<HTMLElement>('[role="columnheader"]')].find((h) => h.textContent?.includes("Thâm niên")),
    );
    await userEvent.click(header);

    expect(onSortChange).toHaveBeenCalledWith(expect.objectContaining({ column: "Seniority" }));
  });

  test("tells which rows are shown and moves to the next page", async () => {
    const onPageChange = vi.fn();
    await renderTable({ onPageChange });

    await vi.waitFor(() => expect(document.body.textContent).toContain("1–10 trên 25 nhân sự"));
    await userEvent.click(button("Sau")!);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test("says when nobody matches", async () => {
    await renderTable({ page: page({ items: [], totalCount: 0, totalPages: 0, hasNextPage: false }) });

    await vi.waitFor(() => expect(document.body.textContent).toContain("Không tìm thấy nhân sự nào."));
  });
});
