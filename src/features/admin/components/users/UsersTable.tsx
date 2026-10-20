"use client";

import { useState, type ReactNode } from "react";
import { Envelope } from "@gravity-ui/icons";
import { Avatar, Chip, Table } from "@heroui/react";
import { formatFullTime } from "@/features/posts/lib/time";
import type { InvitationDto, PaginatedListOfUserDto, UserDto } from "@/shared/api/generated/portalApi";
import { usePhone } from "@/shared/hooks/usePhone";
import { useLocale, type Locale } from "@/shared/i18n";
import { TablePagination } from "@/shared/ui/TablePagination";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { formatDay, formatExpiry, todayAsDateInput } from "../../lib/dates";

export const USERS_PAGE_SIZE = 10;

type Translate = (key: string) => string;

type Props = {
  page: PaginatedListOfUserDto;
  onPageChange: (pageNumber: number) => void;
  pageSize?: number;
  /** Ids of the roles that make their holder an administrator: such a person gets the "Administrator" chip instead. */
  adminRoleIds?: ReadonlySet<number>;
  /** The row's menu ({@link UserActions}); the actions column exists only when this or `invitationActions` is given. */
  actions?: (user: UserDto) => ReactNode;
  /** The invitations still waiting on someone, as rows above the accounts (the caller decides when there are any). */
  invitations?: InvitationDto[];
  /** An invitation row's menu ({@link InvitationActions}). */
  invitationActions?: (invitation: InvitationDto) => ReactNode;
};

type ColumnId = "user" | "place" | "roles" | "status" | "joinedOn" | "actions";
type ColumnDef = {
  id: ColumnId;
  label: string;
  /** The least the column takes, in px: their sum is how wide the table is before it scrolls sideways. */
  width: number;
  cell: (user: UserDto, context: CellContext) => ReactNode;
  /** The same column for an invitation's row. */
  invitation: (invitation: InvitationDto, context: CellContext) => ReactNode;
};
type CellContext = {
  t: Translate; locale: Locale; adminRoleIds: ReadonlySet<number>; actions: Props["actions"]; invitationActions: Props["invitationActions"];
};

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
    invitation: (invitation, { t }) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size="sm" className="shrink-0">
          <Avatar.Fallback><Envelope className="size-4" /></Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground phone:line-clamp-2 phone:whitespace-normal phone:break-all">{invitation.email}</span>
          <span className="truncate text-xs text-muted">{t("admin.invite.invitedBy").replace("{name}", invitation.invitedByName)}</span>
        </div>
      </div>
    ),
  },
  {
    id: "place", label: "admin.columnPlace", width: 220,
    cell: (user) => <span className="block truncate text-foreground">{placeOf(user)}</span>,
    invitation: () => <span className="block truncate text-muted">—</span>,
  },
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
    invitation: (invitation) => (
      <Chip size="sm" variant="secondary">
        {invitation.roleName}
      </Chip>
    ),
  },
  {
    id: "status", label: "admin.status", width: 200,
    cell: (user, { t }) => (
      <div className="flex flex-wrap gap-1">
        {user.isActive ? (
          <Chip size="sm" variant="soft" color="success">{t("admin.statusActive")}</Chip>
        ) : (
          <Chip size="sm" variant="soft">{t("admin.statusDeactivated")}</Chip>
        )}
      </div>
    ),
    invitation: (invitation, { t, locale }) => {
      const expired = invitation.status === "Expired";
      const when = formatExpiry(invitation.expiresAt, locale);
      return (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <Chip size="sm" variant="soft" color={expired ? "danger" : "warning"}>
            {t(expired ? "admin.statusExpired" : "admin.statusPending")}
          </Chip>
          <time dateTime={invitation.expiresAt} title={formatFullTime(invitation.expiresAt, locale)} className="text-xs text-muted">
            {t(expired ? "admin.invite.expiredAt" : "admin.invite.expiresAt").replace("{time}", when)}
          </time>
          {invitation.lastSendFailedAt && <span className="text-xs text-danger">{t("admin.invite.sendFailed")}</span>}
        </div>
      );
    },
  },
  {
    id: "joinedOn", label: "admin.columnJoinedOn", width: 150,
    cell: (user, { locale }) => user.joinedOn
      ? <time dateTime={user.joinedOn} className="text-foreground">{formatDay(user.joinedOn, locale)}</time>
      : <span className="text-muted">—</span>,
    // Not joined yet: when the invitation went out instead.
    invitation: (invitation, { t, locale }) => (
      <time dateTime={invitation.createdAt} title={formatFullTime(invitation.createdAt, locale)} className="text-muted">
        {t("admin.invite.invitedOn").replace("{date}", formatDay(todayAsDateInput(new Date(invitation.createdAt)), locale))}
      </time>
    ),
  },
  {
    id: "actions", label: "admin.columnActions", width: 72,
    cell: (user, { actions }) => actions?.(user),
    invitation: (invitation, { invitationActions }) => invitationActions?.(invitation),
  },
];
/** On a phone the name column takes less of the screen: the name may wrap to two lines. */
const PHONE_NAME_WIDTH = 176;

/** The person's primary department and position ("CNTT · Nhân viên"), or the first they have; the department alone without a position; a dash with none. */
function placeOf(user: UserDto) {
  const assignment = user.assignments.find((a) => a.isPrimary) ?? user.assignments[0];
  if (!assignment) return "—";
  return assignment.positionName ? `${assignment.departmentName} · ${assignment.positionName}` : assignment.departmentName;
}

/**
 * One page of the accounts, paged by the back end, in the shape of the staff table: the person (avatar, name and user
 * name) is the row header and sticks at the start once the table is scrolled sideways, the rest going under it; the pages
 * are in a footer outside the scroll. The row's menu comes from `actions`. The `invitations` given come first, each a row
 * of its own (the email in place of the person, Pending or Expired as its status), with `invitationActions` as its menu.
 */
export function UsersTable({
  page, onPageChange, pageSize = USERS_PAGE_SIZE, adminRoleIds = new Set(), actions, invitations = [], invitationActions,
}: Props) {
  const { t, locale } = useLocale();
  const phone = usePhone();
  // Whether the names have reached the start and stick there (the shadow shows only then).
  const [stuck, setStuck] = useState(false);
  const columns = COLUMNS.filter((column) => column.id !== "actions" || actions || invitationActions);
  const widthOf = (column: ColumnDef) => (phone && column.id === "user" ? PHONE_NAME_WIDTH : column.width);
  const context: CellContext = { t, locale, adminRoleIds, actions, invitationActions };

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
            {invitations.map((invitation) => (
              <Table.Row key={`invitation-${invitation.id}`} id={`invitation-${invitation.id}`}>
                {columns.map((column) => (
                  <Table.Cell key={column.id} className={column.id === "user" ? "table-pinned" : undefined}>{column.invitation(invitation, context)}</Table.Cell>
                ))}
              </Table.Row>
            ))}
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
