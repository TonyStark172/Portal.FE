"use client";

import { Pagination, Table, type SortDescriptor } from "@heroui/react";
import type { PaginatedListOfStaffEmployeeDto, StaffEmployeeSort } from "@/shared/api/generated/portalApi";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { formatDate } from "../../lib/format";
import { formatCount } from "../../lib/genderSlices";
import { useLocale } from "@/shared/i18n";

export const EMPLOYEES_PAGE_SIZE = 10;

type Props = {
  page: PaginatedListOfStaffEmployeeDto;
  sort: SortDescriptor & { column: StaffEmployeeSort };
  onSortChange: (sort: SortDescriptor & { column: StaffEmployeeSort }) => void;
  onPageChange: (pageNumber: number) => void;
  pageSize?: number;
};

/** One page of the people working here, sorted and paged by the back end. */
export function EmployeesTable({ page, sort, onSortChange, onPageChange, pageSize = EMPLOYEES_PAGE_SIZE }: Props) {
  const { t, locale } = useLocale();
  const first = page.totalCount === 0 ? 0 : (page.pageNumber - 1) * pageSize + 1;
  const last = Math.min(page.pageNumber * pageSize, page.totalCount);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={t("dashboard.workingStaff")}
          className="min-w-[1280px]"
          sortDescriptor={sort}
          onSortChange={(next) => onSortChange(next as Props["sort"])}
        >
          <Table.Header>
            <SortableColumn id="EmployeeCode" label={t("dashboard.employeeCode")} className="w-32" />
            <SortableColumn id="FullName" label={t("dashboard.fullName")} isRowHeader />
            <Table.Column className="w-24">{t("dashboard.gender")}</Table.Column>
            <SortableColumn id="DateOfBirth" label={t("dashboard.birthDate")} className="w-32" />
            <Table.Column className="w-36">{t("dashboard.phone")}</Table.Column>
            <Table.Column className="w-36">{t("dashboard.hometown")}</Table.Column>
            <Table.Column>{t("dashboard.position")}</Table.Column>
            <SortableColumn id="Seniority" label={t("dashboard.seniority")} className="w-36" />
          </Table.Header>
          <Table.Body
            renderEmptyState={() => <p className="py-10 text-center text-sm text-muted">{t("dashboard.noStaff")}</p>}
          >
            {page.items.map((employee) => (
              <Table.Row key={employee.userId} id={employee.userId}>
                <Table.Cell className="font-medium tabular-nums text-foreground">
                  {employee.employeeCode ? `#${employee.employeeCode}` : "—"}
                </Table.Cell>
                <Table.Cell>
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar fullName={employee.fullName} avatarUrl={employee.avatarUrl} size="sm" className="shrink-0" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">{employee.fullName}</span>
                      <span className="truncate text-xs text-muted">{employee.email ?? t("dashboard.noEmail")}</span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>{employee.gender ? t(employee.gender === "Male" ? "dashboard.male" : "dashboard.female") : "—"}</Table.Cell>
                <Table.Cell className="tabular-nums">{employee.dateOfBirth ? formatDate(employee.dateOfBirth) : "—"}</Table.Cell>
                <Table.Cell className="tabular-nums">{employee.phoneNumber ?? "—"}</Table.Cell>
                <Table.Cell>
                  <span className="block truncate">{employee.hometown ?? "—"}</span>
                </Table.Cell>
                <Table.Cell>
                  {employee.positionName ? (
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-foreground">{employee.positionName}</span>
                      <span className="truncate text-xs text-muted">{employee.departmentName}</span>
                    </div>
                  ) : (
                    <span className="text-muted">{t("dashboard.noPosition")}</span>
                  )}
                </Table.Cell>
                <Table.Cell>{formatSeniorityLocalized(employee.seniorityDays, locale)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {page.totalCount > 0 && (
        <Table.Footer>
          <Pagination size="sm" className="w-full">
            <Pagination.Summary>
              {t("dashboard.rangeSummary")
                .replace("{first}", formatCount(first))
                .replace("{last}", formatCount(last))
                .replace("{total}", formatCount(page.totalCount))}
            </Pagination.Summary>
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
        </Table.Footer>
      )}
    </Table>
  );
}

function formatSeniorityLocalized(days: number | null | undefined, locale: string) {
  if (days == null) return "—";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (locale === "en-US") return years || months ? `${years ? `${years}y ` : ""}${months ? `${months}mo` : ""}`.trim() : `${days}d`;
  return years || months ? `${years ? `${years} năm ` : ""}${months ? `${months} tháng` : ""}`.trim() : `${days} ngày`;
}

function SortableColumn({ id, label, className, isRowHeader }: { id: StaffEmployeeSort; label: string; className?: string; isRowHeader?: boolean }) {
  return (
    <Table.Column id={id} allowsSorting isRowHeader={isRowHeader} className={className}>
      {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{label}</Table.SortableColumnHeader>}
    </Table.Column>
  );
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
