"use client";

import { Pagination, Table, type SortDescriptor } from "@heroui/react";
import type { PaginatedListOfStaffEmployeeDto, StaffEmployeeSort } from "@/shared/api/generated/portalApi";
import { genderLabels } from "@/shared/lib/gender";
import { formatSeniority } from "@/shared/lib/seniority";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { formatDate } from "../../lib/format";
import { formatCount } from "../../lib/genderSlices";

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
  const first = page.totalCount === 0 ? 0 : (page.pageNumber - 1) * pageSize + 1;
  const last = Math.min(page.pageNumber * pageSize, page.totalCount);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label="Nhân sự đang làm việc"
          className="min-w-[1280px]"
          sortDescriptor={sort}
          onSortChange={(next) => onSortChange(next as Props["sort"])}
        >
          <Table.Header>
            <SortableColumn id="EmployeeCode" label="Mã nhân sự" className="w-32" />
            <SortableColumn id="FullName" label="Họ và tên" isRowHeader />
            <Table.Column className="w-24">Giới tính</Table.Column>
            <SortableColumn id="DateOfBirth" label="Ngày sinh" className="w-32" />
            <Table.Column className="w-36">Số điện thoại</Table.Column>
            <Table.Column className="w-36">Quê quán</Table.Column>
            <Table.Column>Vị trí</Table.Column>
            <SortableColumn id="Seniority" label="Thâm niên" className="w-36" />
          </Table.Header>
          <Table.Body
            renderEmptyState={() => <p className="py-10 text-center text-sm text-muted">Không tìm thấy nhân sự nào.</p>}
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
                      <span className="truncate text-xs text-muted">{employee.email ?? "Chưa có email"}</span>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell>{employee.gender ? genderLabels[employee.gender] : "—"}</Table.Cell>
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
                    <span className="text-muted">Chưa có vị trí</span>
                  )}
                </Table.Cell>
                <Table.Cell>{formatSeniority(employee.seniorityDays)}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {page.totalCount > 0 && (
        <Table.Footer>
          <Pagination size="sm" className="w-full">
            <Pagination.Summary>
              {formatCount(first)}–{formatCount(last)} trên {formatCount(page.totalCount)} nhân sự
            </Pagination.Summary>
            <Pagination.Content>
              <Pagination.Item>
                <Pagination.Previous isDisabled={!page.hasPreviousPage} onPress={() => onPageChange(page.pageNumber - 1)}>
                  <Pagination.PreviousIcon />
                  <span>Trước</span>
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
                  <span>Sau</span>
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
