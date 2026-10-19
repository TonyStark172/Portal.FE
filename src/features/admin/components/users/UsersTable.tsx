"use client";

import { useState, type ReactNode } from "react";
import { Chip, Table } from "@heroui/react";
import { formatFullTime, formatPostTime } from "@/features/posts/lib/time";
import type { PaginatedListOfUserDto, UserDto } from "@/shared/api/generated/portalApi";
import { usePhone } from "@/shared/hooks/usePhone";
import { useLocale, type Locale } from "@/shared/i18n";
import { TablePagination } from "@/shared/ui/TablePagination";
import { UserAvatar } from "@/shared/ui/UserAvatar";

export const USERS_PAGE_SIZE = 10;

type Translate = (key: string) => string;

type Props = {
  page: PaginatedListOfUserDto;
  onPageChange: (pageNumber: number) => void;
  pageSize?: number;
  /** Ids of the roles that make their holder an administrator: such a person gets the "Administrator" chip instead. */
  adminRoleIds?: ReadonlySet<number>;
  /** The row's menu ({@link UserActions}); the actions column exists only when this is given. */
  actions?: (user: UserDto) => ReactNode;
};

type ColumnId = "user" | "place" | "roles" | "status" | "lastSignIn" | "actions";
type ColumnDef = {
  id: ColumnId;
  label: string;
  /** The least the column takes, in px: their sum is how wide the table is before it scrolls sideways. */
  width: number;
  cell: (user: UserDto, context: CellContext) => ReactNode;
};
type CellContext = { t: Translate; locale: Locale; adminRoleIds: ReadonlySet<number>; actions: Props["actions"] };

const COLUMNS: ColumnDef[] = [
  {
    id: "user", label: "admin.columnUser", width: 280,
    cell: (user) => (
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar fullName={user.fullName} size="sm" className="shrink-0" />
        <div className="flex min-w-0 flex-col">
          {/* In a phone's narrow column the name may take two lines rather than lose its end. */}
          <span className="truncate font-medium text-foreground phone:line-clamp-2 phone:whitespace-normal phone:break-words">{user.fullName}</span>
          <span className="truncate text-xs text-muted">{[user.userName, user.email].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
    ),
  },
  { id: "place", label: "admin.columnPlace", width: 220, cell: (user) => <span className="block truncate text-foreground">{placeOf(user)}</span> },
  {
    id: "roles", label: "admin.columnRoles", width: 240,
    cell: (user, { t, adminRoleIds }) => (
      <div className="flex flex-wrap gap-1">
        {user.isAdministrator && (
          <Chip size="sm" variant="soft" color="accent">
            {t("admin.administrator")}
          </Chip>
        )}
        {user.roles.filter((role) => !(user.isAdministrator && adminRoleIds.has(role.id))).map((role) => (
          <Chip key={role.id} size="sm" variant="secondary">
            {role.name}
          </Chip>
        ))}
      </div>
    ),
  },
  {
    id: "status", label: "admin.status", width: 160,
    cell: (user, { t }) => {
      const status = statusOf(user);
      return (
        <Chip size="sm" variant="soft" color={status.color}>
          {t(status.label)}
        </Chip>
      );
    },
  },
  {
    id: "lastSignIn", label: "admin.columnLastSignIn", width: 170,
    cell: (user, { t, locale }) => user.lastLoginAt
      ? <time dateTime={user.lastLoginAt} title={formatFullTime(user.lastLoginAt, locale)} className="text-muted">{formatPostTime(user.lastLoginAt, Date.now(), locale)}</time>
      : <span className="text-muted">{t("admin.neverSignedIn")}</span>,
  },
  { id: "actions", label: "admin.columnActions", width: 72, cell: (user, { actions }) => actions?.(user) },
];
/** On a phone the name column takes less of the screen: the name may wrap to two lines. */
const PHONE_NAME_WIDTH = 176;

/** The person's primary department and position ("CNTT · Nhân viên"), or the first they have; the department alone without a position; a dash with none. */
function placeOf(user: UserDto) {
  const assignment = user.assignments.find((a) => a.isPrimary) ?? user.assignments[0];
  if (!assignment) return "—";
  return assignment.positionName ? `${assignment.departmentName} · ${assignment.positionName}` : assignment.departmentName;
}

/** Left beats waiting for a first password, which beats working: a person who left needs no password. */
function statusOf(user: UserDto): { label: string; color: "default" | "success" | "warning" } {
  if (!user.isActive) return { label: "admin.statusLeft", color: "default" };
  if (user.mustChangePassword) return { label: "admin.statusMustChange", color: "warning" };
  return { label: "admin.statusActive", color: "success" };
}

/**
 * One page of the accounts, paged by the back end, in the shape of the staff table: the person (avatar, name and user
 * name) is the row header and sticks at the start once the table is scrolled sideways, the rest going under it; the pages
 * are in a footer outside the scroll. The row's menu comes from `actions`.
 */
export function UsersTable({ page, onPageChange, pageSize = USERS_PAGE_SIZE, adminRoleIds = new Set(), actions }: Props) {
  const { t, locale } = useLocale();
  const phone = usePhone();
  // Whether the names have reached the start and stick there (the shadow shows only then).
  const [stuck, setStuck] = useState(false);
  const columns = COLUMNS.filter((column) => column.id !== "actions" || actions);
  const widthOf = (column: ColumnDef) => (phone && column.id === "user" ? PHONE_NAME_WIDTH : column.width);
  const context: CellContext = { t, locale, adminRoleIds, actions };

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
          aria-label={t("admin.users")}
          // Fixed: the columns keep the widths given, a long name is cut short instead of widening its column.
          className="table-fixed"
          style={{ minWidth: columns.reduce((sum, column) => sum + widthOf(column), 0) }}
        >
          <Table.Header>
            {columns.map((column) => (
              <Table.Column key={column.id} id={column.id} isRowHeader={column.id === "user"}
                className={column.id === "user" ? "table-pinned" : undefined} style={{ width: widthOf(column) }}>
                {column.id === "actions" ? <span className="sr-only">{t(column.label)}</span> : t(column.label)}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="py-10 text-center text-sm text-muted">{t("admin.noUsers")}</p>}>
            {page.items.map((user) => (
              <Table.Row key={user.id} id={user.id}>
                {columns.map((column) => (
                  <Table.Cell key={column.id} className={column.id === "user" ? "table-pinned" : undefined}>{column.cell(user, context)}</Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      {page.totalCount > 0 && (
        <Table.Footer>
          <TablePagination page={page} summary={rangeOf(page, pageSize, t, locale)} onPageChange={onPageChange} />
        </Table.Footer>
      )}
    </Table>
  );
}

function rangeOf(page: PaginatedListOfUserDto, pageSize: number, t: Translate, locale: Locale) {
  const first = page.totalCount === 0 ? 0 : (page.pageNumber - 1) * pageSize + 1;
  const last = Math.min(page.pageNumber * pageSize, page.totalCount);
  return t("admin.usersRange")
    .replace("{first}", first.toLocaleString(locale))
    .replace("{last}", last.toLocaleString(locale))
    .replace("{total}", page.totalCount.toLocaleString(locale));
}
