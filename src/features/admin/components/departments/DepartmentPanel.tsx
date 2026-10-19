"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PersonPlus, Xmark } from "@gravity-ui/icons";
import { Alert, Button, Dropdown, Label, SearchField, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useGetDepartmentMembersQuery,
  type DepartmentChartNode,
  type DepartmentRole,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { TablePagination } from "@/shared/ui/TablePagination";
import { AddMembersDialog } from "./AddMembersDialog";
import { DepartmentActionMenu } from "./DepartmentActionMenu";
import { departmentActions, type DepartmentAction } from "./departmentActions";
import { MemberRow } from "./MemberRow";

/** Heads and deputies are few: one request each takes them all. Employees are paged. */
const LEADERS_PAGE_SIZE = 100;
const MEMBERS_PAGE_SIZE = 50;

type Props = {
  node: DepartmentChartNode;
  onClose: () => void;
  /** The panel's own "⋯" menu asks for the same things as the card's; the parent opens what they need. */
  onMenuAction: (action: DepartmentAction, node: DepartmentChartNode) => void;
};

/**
 * The details of the selected department, beside the chart (a full-screen sheet below `md`): its name with the "⋯"
 * menu (the card's, built by the same {@link departmentActions}) and a close button, the description, the headcount
 * and a search field (typing pauses 300 ms, then all three groups are asked again), then the groups "Trưởng phòng",
 * "Phó phòng" and "Nhân viên", each its own request (employees are paged at 50). A group's "Thao tác" menu offers
 * "Thêm…", which opens {@link AddMembersDialog} for that role (only on an active department, and only with
 * Departments.Update, which also gates every row menu). A department with nobody invites adding people. The parent
 * gives the panel a `key` of the department so switching departments starts from a clean search and first page.
 */
export function DepartmentPanel({ node, onClose, onMenuAction }: Props) {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [adding, setAdding] = useState<DepartmentRole | null>(null);

  const rights = {
    create: hasPermission(Permissions.Departments.Create),
    update: hasPermission(Permissions.Departments.Update),
    delete: hasPermission(Permissions.Departments.Delete),
  };
  const actions = departmentActions(node, rights, t);
  // Staff cannot be added to a department that is switched off.
  const canAdd = rights.update && node.isActive;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPageNumber(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const query = { id: node.id, search: debouncedSearch || undefined };
  const heads = useGetDepartmentMembersQuery({ ...query, role: "Head", pageNumber: 1, pageSize: LEADERS_PAGE_SIZE });
  const deputies = useGetDepartmentMembersQuery({ ...query, role: "Deputy", pageNumber: 1, pageSize: LEADERS_PAGE_SIZE });
  const members = useGetDepartmentMembersQuery({ ...query, role: "Member", pageNumber, pageSize: MEMBERS_PAGE_SIZE });

  const failed = heads.isError || deputies.isError || members.isError;
  // Nobody at all (not merely nobody matching a search): the invitation replaces the empty list of employees.
  const isEmpty = !debouncedSearch && [heads, deputies, members].every((group) => group.data?.totalCount === 0);

  const groupName = (role: DepartmentRole) => t(`departments.group.${role.toLowerCase()}`).replace("{count}", "").trim();

  function group(role: DepartmentRole, result: typeof heads, body?: ReactNode) {
    const title = t(`departments.group.${role.toLowerCase()}`).replace("{count}", String(result.data?.totalCount ?? 0));
    return (
      <section aria-label={groupName(role)} className="flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-border py-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {canAdd && (
            <Dropdown>
              <Dropdown.Trigger
                aria-label={t("departments.group.actions").replace("{group}", groupName(role))}
                className="rounded-lg px-2 py-1 text-xs font-medium text-accent outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
              >
                {t("departments.group.actionsShort")}
              </Dropdown.Trigger>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu aria-label={t("departments.group.actions").replace("{group}", groupName(role))} onAction={() => setAdding(role)}>
                  <Dropdown.Item id="add" textValue={t("departments.group.add")}>
                    <PersonPlus className="size-4 shrink-0 text-muted" />
                    <Label>{t("departments.group.add")}</Label>
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
        {result.isLoading ? (
          <Skeleton className="my-2 h-10 w-full rounded-lg" />
        ) : (
          (body ?? (
            <ul className="divide-y divide-border">
              {result.data?.items.map((member) => (
                <MemberRow key={member.userId} member={member} department={node} canEdit={rights.update} />
              ))}
            </ul>
          ))
        )}
      </section>
    );
  }

  // An empty leaders' group invites appointing someone; with a search going on, or no right to appoint, it is just empty.
  const hint = (role: "head" | "deputy") =>
    canAdd && !debouncedSearch ? <p className="py-3 text-sm text-muted">{t(`departments.hint.${role}`)}</p> : <></>;

  return (
    <aside
      aria-label={t("departments.panel.label")}
      className="fixed inset-0 z-40 flex flex-col gap-3 overflow-y-auto bg-background p-4 md:static md:z-auto md:max-h-[70vh] md:w-96 md:shrink-0 md:rounded-2xl md:border md:border-border md:bg-surface"
    >
      <header className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 break-words text-base font-semibold">{node.name}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {actions.length > 0 && (
            <DepartmentActionMenu items={actions} label={t("departments.panel.menu")} onAction={(action) => onMenuAction(action, node)} />
          )}
          <Button isIconOnly size="sm" variant="ghost" aria-label={t("departments.panel.close")} onPress={onClose}>
            <Xmark className="size-4" />
          </Button>
        </div>
      </header>

      {node.description && <p className="text-sm text-muted">{node.description}</p>}
      <p className="text-sm">{t("departments.panel.total").replace("{count}", String(node.memberCount))}</p>

      <SearchField aria-label={t("departments.panel.search")} value={search} onChange={setSearch} variant="secondary" fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder={t("departments.panel.search")} />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      {failed && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t("departments.panel.loadError")}</Alert.Description>
          </Alert.Content>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              void heads.refetch();
              void deputies.refetch();
              void members.refetch();
            }}
          >
            {t("admin.retry")}
          </Button>
        </Alert>
      )}

      {group("Head", heads, heads.data?.totalCount === 0 ? hint("head") : undefined)}
      {group("Deputy", deputies, deputies.data?.totalCount === 0 ? hint("deputy") : undefined)}
      {group(
        "Member",
        members,
        isEmpty ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <PersonPlus aria-hidden className="size-8 text-muted" />
            <p className="max-w-64 text-sm text-muted">{t("departments.emptyDepartment")}</p>
            {canAdd && <Button onPress={() => setAdding("Member")}>{t("departments.addShort")}</Button>}
          </div>
        ) : members.data?.totalCount === 0 ? (
          <p className="py-3 text-sm text-muted">{t("departments.panel.noMatches")}</p>
        ) : undefined,
      )}
      {members.data && members.data.totalPages > 1 && (
        <TablePagination
          page={members.data}
          summary={t("departments.panel.range")
            .replace("{first}", String((members.data.pageNumber - 1) * MEMBERS_PAGE_SIZE + 1))
            .replace("{last}", String(Math.min(members.data.pageNumber * MEMBERS_PAGE_SIZE, members.data.totalCount)))
            .replace("{total}", String(members.data.totalCount))}
          onPageChange={setPageNumber}
        />
      )}

      {adding && <AddMembersDialog departmentId={node.id} mode="role" role={adding} onClose={() => setAdding(null)} />}
    </aside>
  );
}
