"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "@gravity-ui/icons";
import { Alert, Button, Chip, ListBox, SearchField, Select, Skeleton, Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useGetDepartmentsQuery, useGetInvitationsQuery, useGetRolesQuery, useGetUsersQuery, type PaginatedListOfUserDto,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { AdminNoAccess } from "../AdminNoAccess";
import { CreateUserDialog } from "./CreateUserDialog";
import { InvitationActions } from "./InvitationActions";
import { InviteMemberRow } from "./InviteMemberRow";
import { TemporaryPasswordDialog } from "./TemporaryPasswordDialog";
import { UserActions } from "./UserActions";
import { USERS_PAGE_SIZE, UsersTable } from "./UsersTable";

/**
 * What the status filter can be; "all" leaves it out of the request. "pending" is the invitations not taken up (pending
 * or run out), which are no accounts: the accounts are then not asked for at all.
 */
type StatusFilter = "all" | "pending" | "active" | "deactivated";
const ALL = "all";

const isActiveOf = (status: StatusFilter) => (status === "active" ? true : status === "deactivated" ? false : undefined);

/** What the table shows in place of the accounts while only the invitations are asked for. */
const NO_USERS: PaginatedListOfUserDto = { items: [], pageNumber: 1, totalPages: 0, totalCount: 0, hasPreviousPage: false, hasNextPage: false };

/**
 * Users: needs Users.View, so anyone else typing /admin/users gets the no-access notice and the requests below are not
 * even sent for them. "Create account" (with Users.Create) opens {@link CreateUserDialog}, whose result, the temporary
 * password, is shown once by {@link TemporaryPasswordDialog}. Each row has its menu ({@link UserActions}: edit, new
 * temporary password, let leave or take back, delete) for whoever holds a right to any of them; with only Users.View the
 * table has no actions column at all.
 *
 * With Users.Create the tab opens with {@link InviteMemberRow}. The invitations not taken up are rows above the accounts
 * on the first page (their menu, {@link InvitationActions}, for Users.Create), narrowed by the search (on the email) and
 * the role; they have no department and are neither active nor deactivated, so those filters leave them out.
 */
export function UsersAdmin() {
  const { hasPermission, isLoading } = useCurrentUser();
  const { t } = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={t("admin.opening")} />
      </div>
    );
  }
  if (!hasPermission(Permissions.Users.View)) return <AdminNoAccess />;

  return <UsersPage />;
}

function UsersPage() {
  const { t, locale } = useLocale();
  const { hasPermission } = useCurrentUser();
  // The departments list has a permission of its own, which a holder of Users.View may lack: then no filter by it.
  const canFilterByDepartment = hasPermission(Permissions.Departments.View);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [roleId, setRoleId] = useState<number | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [pageNumber, setPageNumber] = useState(1);

  const canCreate = hasPermission(Permissions.Users.Create);
  const canAct = [Permissions.Users.Update, Permissions.Users.ResetPassword, Permissions.Users.Delete].some(hasPermission);
  // A new key remounts the create dialog (an empty form) each time it is opened.
  const [creating, setCreating] = useState<number | null>(null);
  const opened = useRef(0);
  // The temporary password lives here and nowhere else, only while its dialog is open; closing it forgets it.
  const [created, setCreated] = useState<{ password: string; fullName: string } | null>(null);

  // Ask the back end once typing pauses, from the first page.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPageNumber(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useGetUsersQuery({
    search: debouncedSearch || undefined,
    departmentId: departmentId ?? undefined,
    roleId: roleId ?? undefined,
    isActive: isActiveOf(status),
    pageNumber,
    pageSize: USERS_PAGE_SIZE,
  }, { skip: status === "pending" });
  const invitations = useGetInvitationsQuery({});
  const departments = useGetDepartmentsQuery({}, { skip: !canFilterByDepartment });
  const roles = useGetRolesQuery();
  const adminRoleIds = useMemo(() => new Set((roles.data ?? []).filter((role) => role.isAdmin).map((role) => role.id)), [roles.data]);

  /** A filter changed: the matching people start from the first page. */
  const filter = (set: (key: string) => void) => (key: string) => {
    set(key);
    setPageNumber(1);
  };

  const { isLoading, isError, refetch } = users;
  const data = status === "pending" ? NO_USERS : users.data;

  const shownInvitations = useMemo(() => {
    if (pageNumber !== 1 || departmentId !== null || (status !== "all" && status !== "pending")) return [];
    const needle = debouncedSearch.toLocaleLowerCase();
    return (invitations.data ?? []).filter((invitation) =>
      (roleId === null || invitation.roleId === roleId) && invitation.email.toLocaleLowerCase().includes(needle));
  }, [invitations.data, pageNumber, departmentId, status, roleId, debouncedSearch]);

  return (
    <section aria-labelledby="users-heading" className="flex flex-col gap-3">
      {canCreate && <InviteMemberRow />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="users-heading" className="text-lg font-semibold">
            {t("admin.users")}
          </h2>
          {data && (
            <Chip size="sm" variant="soft">
              {(status === "pending" ? shownInvitations.length : data.totalCount).toLocaleString(locale)}
            </Chip>
          )}
        </div>
        {canCreate && (
          <Button
            onPress={() => {
              opened.current += 1;
              setCreating(opened.current);
            }}
          >
            <Plus className="size-4" />
            {t("admin.createAccount")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField aria-label={t("admin.searchUsers")} value={search} onChange={setSearch} className="phone:w-full phone:min-w-0">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input className="w-64 phone:w-full" placeholder={t("admin.searchUsers")} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        {canFilterByDepartment && (
          <FilterSelect
            label={t("admin.department")}
            allLabel={t("admin.allDepartments")}
            value={departmentId === null ? ALL : String(departmentId)}
            onChange={filter((key) => setDepartmentId(key === ALL ? null : Number(key)))}
            options={(departments.data ?? []).map((department) => ({ id: String(department.id), name: department.name }))}
          />
        )}
        <FilterSelect
          label={t("admin.columnRoles")}
          allLabel={t("admin.allRoles")}
          value={roleId === null ? ALL : String(roleId)}
          onChange={filter((key) => setRoleId(key === ALL ? null : Number(key)))}
          options={(roles.data ?? []).map((role) => ({ id: String(role.id), name: role.name }))}
        />
        <FilterSelect
          label={t("admin.status")}
          allLabel={t("admin.statusAll")}
          value={status}
          onChange={filter((key) => setStatus(key as StatusFilter))}
          options={[
            { id: "pending", name: t("admin.statusPending") },
            { id: "active", name: t("admin.statusActive") },
            { id: "deactivated", name: t("admin.statusDeactivated") },
          ]}
        />
      </div>

      {isLoading && status !== "pending" ? (
        <div role="status" aria-label={t("admin.opening")} className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (isError && status !== "pending") || !data ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t("admin.usersLoadError")}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => void refetch()}>
            {t("admin.retry")}
          </Button>
        </Alert>
      ) : (
        <UsersTable
          page={data}
          onPageChange={setPageNumber}
          adminRoleIds={adminRoleIds}
          actions={canAct ? (user) => <UserActions user={user} /> : undefined}
          invitations={shownInvitations}
          invitationActions={canCreate ? (invitation) => <InvitationActions invitation={invitation} /> : undefined}
        />
      )}

      {creating !== null && (
        <CreateUserDialog
          key={creating}
          isOpen
          onOpenChange={(open) => !open && setCreating(null)}
          onCreated={(password, fullName) => setCreated({ password, fullName })}
        />
      )}
      {created && (
        <TemporaryPasswordDialog
          password={created.password}
          fullName={created.fullName}
          isOpen
          onOpenChange={(open) => !open && setCreated(null)}
        />
      )}
    </section>
  );
}

type FilterSelectProps = {
  /** What the filter is: shown in front of the chosen option ("Phòng ban: Tất cả") and its accessible name. */
  label: string;
  /** The option that takes the filter off. */
  allLabel: string;
  value: string;
  onChange: (key: string) => void;
  options: { id: string; name: string }[];
};

/** A filter's dropdown: "all" first, then the options. Its name is written in the trigger, so "all" is not left unexplained. */
function FilterSelect({ label, allLabel, value, onChange, options }: FilterSelectProps) {
  const { t } = useLocale();
  return (
    <Select
      aria-label={label}
      className="w-56 phone:w-full"
      selectedKey={value}
      onSelectionChange={(key) => key !== null && onChange(String(key))}
    >
      <Select.Trigger>
        <Select.Value>
          {({ selectedText }) => (
            <span className="truncate">
              <span className="text-muted">{label}: </span>
              {/* The name is already in front, so "all" is just "Tất cả" here ("Phòng ban: Tất cả"); the list keeps the long form. */}
              {value === ALL ? t("admin.statusAll") : selectedText}
            </span>
          )}
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {[{ id: ALL, name: allLabel }, ...options].map((option) => (
            <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
              {option.name}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
