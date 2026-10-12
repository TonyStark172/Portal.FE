import "@/app/globals.css";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page as browserPage, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { makeStore } from "@/core/store";
import type { PaginatedListOfStaffEmployeeDto } from "@/shared/api/generated/portalApi";
import { EmployeeColumnsMenu, EmployeesTable, HIDDEN_COLUMNS_KEY, useHiddenEmployeeColumns } from "./EmployeesTable";

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
      gender: "Male",
      phoneNumber: "0912345678",
      hometown: "Hà Nội",
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
      gender: null,
      phoneNumber: null,
      hometown: null,
    },
  ],
  ...overrides,
});

const rows = () => [...document.querySelectorAll<HTMLElement>('tbody [role="row"], tbody tr')];
const button = (name: string) =>
  [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === name || b.getAttribute("aria-label") === name);
const scroller = () => document.querySelector<HTMLElement>(".table__scroll-container")!;
const nameHeader = () => [...document.querySelectorAll<HTMLElement>('[role="columnheader"]')].find((h) => h.textContent?.includes("Họ và tên"))!;
const nameCell = (row = 0) => rows()[row].querySelector<HTMLElement>('[role="rowheader"]')!;
const codeCell = (row = 0) => rows()[row].children[0] as HTMLElement;

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

/** Scrolls the table sideways and lets the browser lay it out again. */
async function scrollSideways(by: number) {
  scroller().scrollLeft = by;
  scroller().dispatchEvent(new Event("scroll"));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

describe("the employees table", () => {
  test("shows the code first, then the name beside its avatar, seniority, birth date, position and the other details", async () => {
    await renderTable();

    await vi.waitFor(() => expect(rows().length).toBe(2));
    const headers = [...document.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      "Mã nhân sự",
      "Họ và tên",
      "Thâm niên",
      "Ngày sinh",
      "Vị trí",
      "Số điện thoại",
      "Quê quán",
      "Giới tính",
    ]);
    const cells = (row: number) =>
      [...rows()[row].querySelectorAll<HTMLElement>('[role="gridcell"], [role="rowheader"], td, th')].map((c) => c.textContent?.trim());
    expect(cells(0)).toEqual([
      "#00003",
      expect.stringContaining("Nguyễn Văn An"),
      "1 năm 1 tháng",
      "20/05/1990",
      expect.stringContaining("Trưởng phòng"),
      "0912345678",
      "Hà Nội",
      "Nam",
    ]);
    expect(cells(0)[1]).toContain("an.nv@portal.local");
    expect(nameCell().querySelector("[data-slot='avatar-fallback']")?.textContent).toBe("A");
    expect(cells(0)[4]).toContain("Phòng CNTT");
    expect(cells(1)).toEqual([
      "#00004",
      expect.stringContaining("Mai Văn Minh"),
      "—",
      "—",
      "Chưa có vị trí",
      "—",
      "—",
      "—",
    ]);
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

  test("the name column sits after the code, then sticks at the start once scrolled to, with a shadow only then", async () => {
    await browserPage.viewport(1000, 800);
    await renderTable();
    await vi.waitFor(() => expect(rows().length).toBe(2));
    expect(scroller().scrollWidth).toBeGreaterThan(scroller().clientWidth);
    const start = scroller().getBoundingClientRect().left;
    const nameAt = nameCell().getBoundingClientRect().left;
    expect(nameAt).toBeGreaterThan(start + 50);
    expect(getComputedStyle(nameCell()).boxShadow).toBe("none");

    // A little: everything moves together, nothing is stuck yet.
    await scrollSideways(30);
    expect(nameCell().getBoundingClientRect().left).toBeCloseTo(nameAt - 30, 0);
    expect(getComputedStyle(nameCell()).boxShadow).toBe("none");

    // Past the code: the names stay at the start, the code goes under them.
    await scrollSideways(400);
    for (const pinned of [nameHeader(), nameCell(), nameCell(1)]) expect(Math.abs(pinned.getBoundingClientRect().left - start)).toBeLessThanOrEqual(1);
    expect(codeCell().getBoundingClientRect().left).toBeLessThan(start);
    expect(getComputedStyle(nameCell()).boxShadow).not.toBe("none");
    // What scrolls under it does not show through, even under the pointer.
    await userEvent.hover(nameCell());
    const background = getComputedStyle(nameCell()).backgroundColor;
    expect(background).not.toMatch(/rgba\(.*, 0(\.\d+)?\)$|\/ 0(\.\d+)?\)$|transparent/);
  });

  test.each([333.7, 140.5, 400])("stuck at a scroll of %f, the names overlap the edge, so no sliver of what is under them shows at the seam", async (by) => {
    await renderTable();
    await vi.waitFor(() => expect(rows().length).toBe(2));
    const edge = scroller().getBoundingClientRect().left;

    await scrollSideways(by);

    // Text under it may sit at a fraction of a pixel; the stuck cell starts before the edge (that part is clipped).
    for (const pinned of [nameHeader(), nameCell(), nameCell(1)]) expect(pinned.getBoundingClientRect().left).toBeLessThanOrEqual(edge - 0.5);
  });

  test("once stuck, the names paint their own background a few pixels past the edge, whatever the pixel rounding", async () => {
    await renderTable();
    await vi.waitFor(() => expect(rows().length).toBe(2));
    // Not before: that band would cover the end of the code column.
    expect(getComputedStyle(nameCell()).boxShadow).toBe("none");

    await scrollSideways(400);

    for (const pinned of [nameHeader(), nameCell()]) {
      const { boxShadow, backgroundColor } = getComputedStyle(pinned);
      // The first shadow is a solid band, to the left, in the cell's own colour.
      expect(boxShadow.startsWith(`${backgroundColor} -8px 0px 0px 0px`)).toBe(true);
    }
    await userEvent.hover(nameCell());
    const hovered = getComputedStyle(nameCell());
    expect(hovered.boxShadow.startsWith(`${hovered.backgroundColor} -8px 0px 0px 0px`)).toBe(true);
  });

  test("the stuck names are moved by the compositor with the scroll, so a fast flick does not leave them a frame behind", async () => {
    await renderTable();
    await vi.waitFor(() => expect(rows().length).toBe(2));

    // A layer of their own (only a proxy: the lag itself cannot be measured here).
    for (const pinned of [nameHeader(), nameCell(), nameCell(1)]) expect(getComputedStyle(pinned).willChange).toBe("transform");
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

describe("the employees table on a phone", () => {
  beforeEach(async () => {
    await browserPage.viewport(390, 844);
  });
  afterEach(async () => {
    await browserPage.viewport(1000, 800);
  });

  const longPage = () =>
    page({
      items: [
        {
          ...page().items[0],
          fullName: "Nguyễn Thị Thanh Hương Phương Lan Anh Thư",
          email: "huong.nguyen.thi.thanh.phuong.lan@portal.local",
          positionName: "Phó giám đốc điều hành khối vận hành và chuyển đổi số",
          departmentName: "Phòng Hành chính nhân sự và tổng hợp",
        },
        page().items[1],
      ],
    });

  test("is the same table, not cards, scrolling sideways inside itself, never the page", async () => {
    await renderTable({ page: longPage() });

    await vi.waitFor(() => expect(rows().length).toBe(2));
    expect(document.querySelector("[data-employee-card]")).toBeNull();
    expect(scroller().scrollWidth).toBeGreaterThan(scroller().clientWidth);
    expect(scroller().getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth + 1);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  test("keeps the names in a column under half the screen, stuck at the start once scrolled past the code", async () => {
    await renderTable({ page: longPage() });
    await vi.waitFor(() => expect(rows().length).toBe(2));
    const start = scroller().getBoundingClientRect().left;
    expect(nameCell().getBoundingClientRect().width).toBeLessThan(window.innerWidth / 2);

    await scrollSideways(300);

    for (const pinned of [nameHeader(), nameCell(), nameCell(1)]) expect(Math.abs(pinned.getBoundingClientRect().left - start)).toBeLessThanOrEqual(1);
  });

  test("sorts by tapping a column header; there is no separate sort control", async () => {
    const onSortChange = vi.fn();
    const screen = await renderTable({ onSortChange });
    await vi.waitFor(() => expect(rows().length).toBe(2));

    expect(screen.getByRole("button", { name: /Sắp xếp theo/ }).query()).toBeNull();
    const header = [...document.querySelectorAll<HTMLElement>('[role="columnheader"]')].find((h) => h.textContent?.includes("Thâm niên"))!;
    await userEvent.click(header);
    expect(onSortChange).toHaveBeenCalledWith(expect.objectContaining({ column: "Seniority" }));
  });

  test("pages with a compact footer: which rows, the page of pages, and previous/next icons", async () => {
    const onPageChange = vi.fn();
    await renderTable({ onPageChange });

    await vi.waitFor(() => expect(document.body.textContent).toContain("1–10 trên 25 nhân sự"));
    const footer = document.querySelector<HTMLElement>(".table__footer")!;
    expect(footer.textContent).toContain("1/3");
    expect(footer.querySelectorAll("[data-slot='pagination-link']")).toHaveLength(0);
    expect(button("Sau")!.textContent?.trim()).toBe("");
    await userEvent.click(button("Sau")!);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  test("keeps the footer inside the screen on a far page", async () => {
    await renderTable({ page: page({ pageNumber: 10, totalPages: 20, totalCount: 200, hasPreviousPage: true }) });

    await vi.waitFor(() => expect(document.body.textContent).toContain("91–100 trên 200 nhân sự"));
    const footer = document.querySelector<HTMLElement>(".table__footer")!;
    for (const element of footer.querySelectorAll<HTMLElement>("*")) expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth + 1);
  });

  test("says when nobody matches", async () => {
    await renderTable({ page: page({ items: [], totalCount: 0, totalPages: 0, hasNextPage: false }) });

    await vi.waitFor(() => expect(document.body.textContent).toContain("Không tìm thấy nhân sự nào."));
  });
});

/** The table with its columns menu, as the dashboard puts them together. */
function WithColumns() {
  const [hidden, setHidden] = useHiddenEmployeeColumns();
  return (
    <Provider store={makeStore()}>
      <EmployeeColumnsMenu hidden={hidden} onChange={setHidden} />
      <EmployeesTable page={page()} sort={{ column: "EmployeeCode", direction: "ascending" }} onSortChange={vi.fn()} onPageChange={vi.fn()} hidden={hidden} />
    </Provider>
  );
}
const headerNames = () => [...document.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent?.trim());

describe("the employees table's columns", () => {
  beforeEach(() => localStorage.removeItem(HIDDEN_COLUMNS_KEY));
  afterEach(() => localStorage.removeItem(HIDDEN_COLUMNS_KEY));

  test("hidden columns leave the header and every row", async () => {
    await renderTable({ hidden: ["phone", "gender"] });
    await vi.waitFor(() => expect(rows().length).toBe(2));

    expect(headerNames()).toEqual(["Mã nhân sự", "Họ và tên", "Thâm niên", "Ngày sinh", "Vị trí", "Quê quán"]);
    for (const row of rows()) expect(row.children).toHaveLength(6);
  });

  test("the columns menu ticks what is shown, unticking hides it, and the name always stays", async () => {
    const screen = await render(<WithColumns />);
    await vi.waitFor(() => expect(rows().length).toBe(2));

    await userEvent.click(screen.getByRole("button", { name: "Cột" }));
    const phone = screen.getByRole("menuitemcheckbox", { name: "Số điện thoại" });
    await expect.element(phone).toHaveAttribute("aria-checked", "true");
    await expect.element(screen.getByRole("menuitemcheckbox", { name: "Họ và tên" })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(phone);

    await vi.waitFor(() => expect(headerNames()).not.toContain("Số điện thoại"));
    expect(headerNames()).toContain("Họ và tên");
    await expect.element(phone).toHaveAttribute("aria-checked", "false");
  });

  test("the choice is remembered for next time", async () => {
    const first = await render(<WithColumns />);
    await vi.waitFor(() => expect(rows().length).toBe(2));
    await userEvent.click(first.getByRole("button", { name: "Cột" }));
    await userEvent.click(first.getByRole("menuitemcheckbox", { name: "Quê quán" }));
    await vi.waitFor(() => expect(headerNames()).not.toContain("Quê quán"));
    await first.unmount();

    await render(<WithColumns />);
    await vi.waitFor(() => expect(rows().length).toBe(2));
    expect(headerNames()).not.toContain("Quê quán");
  });

  test("on a phone the columns button is an icon", async () => {
    await browserPage.viewport(390, 844);
    try {
      const screen = await render(<WithColumns />);
      const columns = screen.getByRole("button", { name: "Cột" });
      await expect.element(columns).toBeVisible();
      expect(columns.element().textContent?.trim()).toBe("");
    } finally { await browserPage.viewport(1000, 800); }
  });
});
