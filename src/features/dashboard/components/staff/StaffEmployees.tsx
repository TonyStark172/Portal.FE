"use client";

import { useEffect, useState } from "react";
import { Button, Chip, SearchField, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetStaffEmployeesQuery } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { formatCount } from "../../lib/genderSlices";
import { DashboardNoAccess } from "../DashboardNoAccess";
import { EMPLOYEES_PAGE_SIZE, EmployeeColumnsMenu, EmployeesTable, useHiddenEmployeeColumns } from "./EmployeesTable";

type Sort = Parameters<typeof EmployeesTable>[0]["sort"];

/** "Nhân sự": the staff working here now, a page of its own. Same permission as the staff statistics. */
export function StaffEmployees() {
  const { hasPermission, isLoading } = useCurrentUser();

  if (isLoading) return <EmployeesSkeleton />;
  if (!hasPermission(Permissions.Dashboard.Staff)) return <DashboardNoAccess />;

  return <StaffEmployeesContent />;
}

/** Rendered only for permitted users, so others never request the list. Search, sort by column, choose the columns, page by page. */
function StaffEmployeesContent() {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ column: "EmployeeCode", direction: "ascending" });
  const [pageNumber, setPageNumber] = useState(1);
  const [hidden, setHidden] = useHiddenEmployeeColumns();

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
    <section aria-labelledby="employees-heading" className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 id="employees-heading" className="text-2xl font-semibold text-foreground phone:text-lg">
            {t("nav.hr")}
          </h1>
          {data && (
            <Chip size="sm" variant="soft">
              {formatCount(data.totalCount)}
            </Chip>
          )}
        </div>
        {/* The search and which columns: full width under the title on a phone. */}
        <div className="flex items-center gap-2 phone:w-full">
          <SearchField aria-label={t("dashboard.searchStaff")} value={search} onChange={setSearch} className="phone:min-w-0 phone:flex-1">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input className="w-64 phone:w-full" placeholder={t("dashboard.searchStaffPlaceholder")} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <EmployeeColumnsMenu hidden={hidden} onChange={setHidden} />
        </div>
      </div>

      {isLoading ? (
        <EmployeesSkeleton />
      ) : isError || !data ? (
        <div className="flex items-center gap-3 text-sm text-muted">
          {t("dashboard.staffLoadError")}
          <Button size="sm" variant="secondary" onPress={() => void refetch()}>
            {t("common.retry")}
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
          hidden={hidden}
        />
      )}
    </section>
  );
}

function EmployeesSkeleton() {
  const { t } = useLocale();
  return (
    <div role="status" aria-label={t("dashboard.loadingStaff")} className="flex flex-col gap-2">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
