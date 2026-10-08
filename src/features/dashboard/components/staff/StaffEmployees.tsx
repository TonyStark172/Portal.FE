"use client";

import { useEffect, useState } from "react";
import { Button, Chip, SearchField, Skeleton } from "@heroui/react";
import { useGetStaffEmployeesQuery } from "@/shared/api/generated/portalApi";
import { formatCount } from "../../lib/genderSlices";
import { EMPLOYEES_PAGE_SIZE, EmployeesTable } from "./EmployeesTable";

type Sort = Parameters<typeof EmployeesTable>[0]["sort"];

/** The people working here now: search, sort by column, page by page. */
export function StaffEmployees() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ column: "EmployeeCode", direction: "ascending" });
  const [pageNumber, setPageNumber] = useState(1);

  // Ask the back end once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPageNumber(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch } = useGetStaffEmployeesQuery({
    search: debouncedSearch || undefined,
    sortBy: sort.column,
    descending: sort.direction === "descending",
    pageNumber,
    pageSize: EMPLOYEES_PAGE_SIZE,
  });

  return (
    <section aria-labelledby="employees-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="employees-heading" className="text-base font-semibold text-foreground">
            Nhân sự đang làm việc
          </h2>
          {data && (
            <Chip size="sm" variant="soft">
              {formatCount(data.totalCount)}
            </Chip>
          )}
        </div>
        <SearchField aria-label="Tìm nhân sự" value={search} onChange={setSearch}>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input className="w-64" placeholder="Tìm theo tên, mã nhân sự, email…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Đang tải danh sách nhân sự" className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : isError || !data ? (
        <div className="flex items-center gap-3 text-sm text-muted">
          Không tải được danh sách nhân sự.
          <Button size="sm" variant="secondary" onPress={() => void refetch()}>
            Thử lại
          </Button>
        </div>
      ) : (
        <EmployeesTable
          page={data}
          sort={sort}
          onSortChange={(next) => {
            setSort(next);
            setPageNumber(1);
          }}
          onPageChange={setPageNumber}
        />
      )}
    </section>
  );
}
