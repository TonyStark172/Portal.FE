"use client";

import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutColumns3 } from "@gravity-ui/icons";
import { Button, Dropdown, Label, Pagination, Table, type Selection, type SortDescriptor } from "@heroui/react";
import type { PaginatedListOfStaffEmployeeDto, StaffEmployeeDto, StaffEmployeeSort } from "@/shared/api/generated/portalApi";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { formatDate } from "../../lib/format";
import { formatCount } from "../../lib/genderSlices";
import { usePhone } from "@/shared/hooks/usePhone";
import { useLocale } from "@/shared/i18n";

export const EMPLOYEES_PAGE_SIZE = 10;

/** A column of the table; the name is always shown, the others can be hidden. */
export type EmployeeColumn = "name" | "code" | "seniority" | "birthDate" | "position" | "phone" | "hometown" | "gender";

type Props = {
  page: PaginatedListOfStaffEmployeeDto;
  sort: SortDescriptor & { column: StaffEmployeeSort };
  onSortChange: (sort: SortDescriptor & { column: StaffEmployeeSort }) => void;
  onPageChange: (pageNumber: number) => void;
  pageSize?: number;
  /** Columns left out (EmployeeColumnsMenu); the name cannot be. */
  hidden?: readonly EmployeeColumn[];
};

type Translate = (key: string) => string;
type ColumnDef = {
  id: EmployeeColumn;
  label: string;
  /** The back end's sort for the column, when it has one. */
  sort?: StaffEmployeeSort;
  /** The least the column takes, in px: their sum is how wide the table is before it scrolls sideways. */
  width: number;
  cell: (employee: StaffEmployeeDto, t: Translate, locale: string) => ReactNode;
};

const COLUMNS: ColumnDef[] = [
  { id: "code", label: "dashboard.employeeCode", sort: "EmployeeCode", width: 130, cell: (employee) => <span className="font-medium tabular-nums">{employee.employeeCode ? `#${employee.employeeCode}` : "—"}</span> },
  {
    id: "name", label: "dashboard.fullName", sort: "FullName", width: 280,
    cell: (employee, t) => (
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar fullName={employee.fullName} avatarUrl={employee.avatarUrl} size="sm" className="shrink-0" />
        <div className="flex min-w-0 flex-col">
          {/* In a phone's narrow column the name may take two lines rather than lose its end. */}
          <span className="truncate font-medium text-foreground phone:line-clamp-2 phone:whitespace-normal phone:break-words">{employee.fullName}</span>
          <span className="truncate text-xs text-muted">{employee.email ?? t("dashboard.noEmail")}</span>
        </div>
      </div>
    ),
  },
  { id: "seniority", label: "dashboard.seniority", sort: "Seniority", width: 130, cell: (employee, _t, locale) => formatSeniorityLocalized(employee.seniorityDays, locale) },
  { id: "birthDate", label: "dashboard.birthDate", sort: "DateOfBirth", width: 120, cell: (employee) => <span className="tabular-nums">{employee.dateOfBirth ? formatDate(employee.dateOfBirth) : "—"}</span> },
  {
    id: "position", label: "dashboard.position", width: 240,
    cell: (employee, t) => employee.positionName ? (
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-foreground">{employee.positionName}</span>
        <span className="truncate text-xs text-muted">{employee.departmentName}</span>
      </div>
    ) : <span className="text-muted">{t("dashboard.noPosition")}</span>,
  },
  { id: "phone", label: "dashboard.phone", width: 140, cell: (employee) => <span className="tabular-nums">{employee.phoneNumber ?? "—"}</span> },
  { id: "hometown", label: "dashboard.hometown", width: 150, cell: (employee) => <span className="block truncate">{employee.hometown ?? "—"}</span> },
  { id: "gender", label: "dashboard.gender", width: 100, cell: (employee, t) => employee.gender ? t(employee.gender === "Male" ? "dashboard.male" : "dashboard.female") : "—" },
];
/** On a phone the name column takes less of the screen: the name may wrap to two lines. */
const PHONE_NAME_WIDTH = 176;

/**
 * One page of the people working here, sorted and paged by the back end. The same table on every screen, as HeroUI
 * Pro's DataGrid "Team Members" (built here on the free Table): the code first, then the name, which sticks at the start
 * once the table is scrolled past the code, the rest going under it; sorting is on the column headers, and the pages are
 * in a footer outside the scroll.
 */
export function EmployeesTable({ page, sort, onSortChange, onPageChange, pageSize = EMPLOYEES_PAGE_SIZE, hidden = [] }: Props) {
  const { t, locale } = useLocale();
  const phone = usePhone();
  // Whether the names have reached the start and stick there (the shadow shows only then).
  const [stuck, setStuck] = useState(false);
  const columns = COLUMNS.filter((column) => column.id === "name" || !hidden.includes(column.id));
  const widthOf = (column: ColumnDef) => (phone && column.id === "name" ? PHONE_NAME_WIDTH : column.width);

  return (
    <Table>
      <Table.ScrollContainer data-stuck={stuck || undefined} onScroll={(event) => {
        // Where the names start unscrolled: the widths of the columns before them (a stuck cell's own offset moves).
        const names = event.currentTarget.querySelector<HTMLElement>("th.table-pinned");
        let before = 0;
        for (let column = names?.previousElementSibling; column; column = column.previousElementSibling) before += (column as HTMLElement).offsetWidth;
        setStuck(!!names && event.currentTarget.scrollLeft > 0 && event.currentTarget.scrollLeft >= before - 1);
      }}>
        <Table.Content
          aria-label={t("dashboard.workingStaff")}
          // Fixed: the columns keep the widths given, a long name is cut short instead of widening its column.
          className="table-fixed"
          style={{ minWidth: columns.reduce((sum, column) => sum + widthOf(column), 0) }}
          sortDescriptor={sort}
          onSortChange={(next) => onSortChange(next as Props["sort"])}
        >
          <Table.Header>
            {columns.map((column) => (
              <Table.Column key={column.id} id={column.sort ?? column.id} allowsSorting={!!column.sort} isRowHeader={column.id === "name"}
                className={column.id === "name" ? "table-pinned" : undefined} style={{ width: widthOf(column) }}>
                {({ sortDirection }) => column.sort
                  ? <Table.SortableColumnHeader sortDirection={sortDirection}>{t(column.label)}</Table.SortableColumnHeader>
                  : t(column.label)}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="py-10 text-center text-sm text-muted">{t("dashboard.noStaff")}</p>}>
            {page.items.map((employee) => (
              <Table.Row key={employee.userId} id={employee.userId}>
                {columns.map((column) => (
                  <Table.Cell key={column.id} className={column.id === "name" ? "table-pinned" : undefined}>{column.cell(employee, t, locale)}</Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {page.totalCount > 0 && (
        <Table.Footer>
          {phone
            ? <CompactPagination page={page} pageSize={pageSize} onPageChange={onPageChange} />
            : <EmployeesPagination page={page} pageSize={pageSize} onPageChange={onPageChange} />}
        </Table.Footer>
      )}
    </Table>
  );
}

/** Where the hidden columns are remembered, in this browser. */
export const HIDDEN_COLUMNS_KEY = "portal.staff.hiddenColumns";
const CHANGED = "portal:hidden-columns";
const readHidden = () => {
  try { return localStorage.getItem(HIDDEN_COLUMNS_KEY) ?? ""; } catch { return ""; }
};
const subscribeHidden = (notify: () => void) => {
  window.addEventListener("storage", notify);
  window.addEventListener(CHANGED, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(CHANGED, notify); };
};

/** The columns this viewer hid, remembered in the browser; none on the server and while hydrating. */
export function useHiddenEmployeeColumns(): [EmployeeColumn[], (hidden: EmployeeColumn[]) => void] {
  const stored = useSyncExternalStore(subscribeHidden, readHidden, () => "");
  const hidden = useMemo(() => {
    try {
      const value: unknown = JSON.parse(stored || "[]");
      return Array.isArray(value) ? COLUMNS.filter((column) => column.id !== "name" && value.includes(column.id)).map((column) => column.id) : [];
    } catch { return []; }
  }, [stored]);
  const setHidden = useCallback((next: EmployeeColumn[]) => {
    try { localStorage.setItem(HIDDEN_COLUMNS_KEY, JSON.stringify(next)); } catch { /* not remembered: private mode or blocked storage */ }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [hidden, setHidden];
}

/** Which columns the table shows: a ticked list, the name always on. An icon on a phone. */
export function EmployeeColumnsMenu({ hidden, onChange }: { hidden: readonly EmployeeColumn[]; onChange: (hidden: EmployeeColumn[]) => void }) {
  const { t } = useLocale();
  const phone = usePhone();
  const shown = new Set<EmployeeColumn>(COLUMNS.map((column) => column.id).filter((id) => !hidden.includes(id)));
  const change = (keys: Selection) => {
    const kept = keys === "all" ? COLUMNS.map((column) => column.id) : [...keys];
    onChange(COLUMNS.filter((column) => column.id !== "name" && !kept.includes(column.id)).map((column) => column.id));
  };
  return (
    <Dropdown>
      <Button variant="secondary" isIconOnly={phone} aria-label={t("dashboard.columns")} className={phone ? "tap-target shrink-0" : "shrink-0"}>
        <LayoutColumns3 aria-hidden className="size-4" />
        {!phone && t("dashboard.columns")}
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-52">
        <Dropdown.Menu aria-label={t("dashboard.columns")} selectionMode="multiple" selectedKeys={shown} disabledKeys={["name"]} onSelectionChange={change}>
          {COLUMNS.map((column) => (
            <Dropdown.Item key={column.id} id={column.id} textValue={t(column.label)}>
              <Dropdown.ItemIndicator />
              <Label>{t(column.label)}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function rangeOf(page: PaginatedListOfStaffEmployeeDto, pageSize: number, t: Translate) {
  const first = page.totalCount === 0 ? 0 : (page.pageNumber - 1) * pageSize + 1;
  const last = Math.min(page.pageNumber * pageSize, page.totalCount);
  return t("dashboard.rangeSummary")
    .replace("{first}", formatCount(first))
    .replace("{last}", formatCount(last))
    .replace("{total}", formatCount(page.totalCount));
}

/** A phone's pages: which rows, the page of pages, and previous/next as icons. */
function CompactPagination({ page, pageSize, onPageChange }: { page: PaginatedListOfStaffEmployeeDto; pageSize: number; onPageChange: (pageNumber: number) => void }) {
  const { t } = useLocale();
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2 text-xs text-muted">
      <span className="min-w-0 truncate">{rangeOf(page, pageSize, t)}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" isIconOnly className="tap-target" aria-label={t("dashboard.previous")} isDisabled={!page.hasPreviousPage} onPress={() => onPageChange(page.pageNumber - 1)}>
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="tabular-nums">{page.pageNumber}/{page.totalPages}</span>
        <Button size="sm" variant="ghost" isIconOnly className="tap-target" aria-label={t("dashboard.next")} isDisabled={!page.hasNextPage} onPress={() => onPageChange(page.pageNumber + 1)}>
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function EmployeesPagination({ page, pageSize, onPageChange }: { page: PaginatedListOfStaffEmployeeDto; pageSize: number; onPageChange: (pageNumber: number) => void }) {
  const { t } = useLocale();

  return (
    <Pagination size="sm" className="w-full">
      <Pagination.Summary>{rangeOf(page, pageSize, t)}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={!page.hasPreviousPage} onPress={() => onPageChange(page.pageNumber - 1)}>
            <Pagination.PreviousIcon />
            <span>{t("dashboard.previous")}</span>
          </Pagination.Previous>
        </Pagination.Item>
        {pageNumbers(page.pageNumber, page.totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <Pagination.Item key={`ellipsis-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={p}>
              <Pagination.Link isActive={p === page.pageNumber} onPress={() => onPageChange(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next isDisabled={!page.hasNextPage} onPress={() => onPageChange(page.pageNumber + 1)}>
            <span>{t("dashboard.next")}</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

function formatSeniorityLocalized(days: number | null | undefined, locale: string) {
  if (days == null) return "—";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (locale === "en-US") return years || months ? `${years ? `${years}y ` : ""}${months ? `${months}mo` : ""}`.trim() : `${days}d`;
  return years || months ? `${years ? `${years} năm ` : ""}${months ? `${months} tháng` : ""}`.trim() : `${days} ngày`;
}

/** First, last, and the pages around the current one, with gaps in between. */
function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}
