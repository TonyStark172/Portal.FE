"use client";

import { useEffect, useState } from "react";
import { Alert, Chip, SearchField, Skeleton } from "@heroui/react";
import { useGetDepartmentMembersQuery } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { TablePagination } from "@/shared/ui/TablePagination";
import { UserAvatar } from "@/shared/ui/UserAvatar";

export const MEMBERS_PAGE_SIZE = 20;

/**
 * The people working in a department, highest rank first, a page at a time (a department may hold thousands), with
 * a search by name, user name or email. The heads (the highest rank there) are marked, and so are concurrent
 * positions.
 */
export function DepartmentMembers({ departmentId }: { departmentId: number }) {
  const { t, locale } = useLocale();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPageNumber(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const members = useGetDepartmentMembersQuery({ id: departmentId, search: debounced || undefined, pageNumber, pageSize: MEMBERS_PAGE_SIZE });
  const page = members.data;

  return (
    <section aria-labelledby="department-members" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="department-members" className="text-base font-semibold">{t("admin.members")}</h3>
        <SearchField aria-label={t("admin.searchMembers")} value={search} onChange={setSearch} className="phone:w-full phone:min-w-0">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input className="w-56 phone:w-full" placeholder={t("admin.searchMembers")} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      {members.isError ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{t("admin.membersLoadError")}</Alert.Description></Alert.Content>
        </Alert>
      ) : !page ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : page.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t(debounced ? "admin.noMembersFound" : "admin.noMembers")}</p>
      ) : (
        <>
          <ul aria-label={t("admin.members")} className="flex flex-col divide-y divide-separator">
            {page.items.map((member) => (
              <li key={`${member.userId}-${member.positionId}`} aria-label={member.fullName} className="flex min-w-0 items-center gap-3 py-2">
                <UserAvatar fullName={member.fullName} size="sm" className="shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-foreground">{member.fullName}</span>
                  <span className="truncate text-xs text-muted">@{member.userName}</span>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 text-sm">
                  <span className="text-foreground">{member.positionName}</span>
                  {!member.isPrimary && <span className="text-xs text-muted">{t("admin.concurrent")}</span>}
                  {member.isHead && <Chip size="sm" variant="soft" color="accent">{t("admin.head")}</Chip>}
                </div>
              </li>
            ))}
          </ul>
          {page.totalPages > 1 && (
            <TablePagination
              page={page}
              summary={t("admin.membersRange")
                .replace("{first}", ((page.pageNumber - 1) * MEMBERS_PAGE_SIZE + 1).toLocaleString(locale))
                .replace("{last}", Math.min(page.pageNumber * MEMBERS_PAGE_SIZE, page.totalCount).toLocaleString(locale))
                .replace("{total}", page.totalCount.toLocaleString(locale))}
              onPageChange={setPageNumber}
            />
          )}
        </>
      )}
    </section>
  );
}
