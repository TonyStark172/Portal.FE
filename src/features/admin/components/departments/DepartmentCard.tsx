"use client";

import type { Key } from "react";
import { Ellipsis, Eye, Plus, TrashBin } from "@gravity-ui/icons";
import { AvatarGroup, Card, Chip, Dropdown, Skeleton } from "@heroui/react";
import { useGetDepartmentMembersQuery, type DepartmentDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";

/** How many faces a card shows before "+N". */
const FACES = 3;
/** Tints for the badge, picked by id so a department keeps its colour. */
const TINTS = [
  "bg-accent-soft text-accent-soft-foreground",
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-danger/15 text-danger",
  "bg-default text-foreground",
];

type Action = "view" | "addChild" | "delete";

type Props = {
  department: DepartmentDto;
  onOpen: () => void;
  /** Leave out what the viewer may not do. */
  onAddChild?: () => void;
  onDelete?: () => void;
};

/**
 * A department as a card: its badge and name (which opens its details), the department it is part of, how many
 * people and sub-departments it has, the first faces, its code, and a menu of what the viewer may do with it.
 */
export function DepartmentCard({ department, onOpen, onAddChild, onDelete }: Props) {
  const { t } = useLocale();
  const actions: { id: Action; label: string; icon: typeof Eye; danger?: boolean }[] = [
    { id: "view", label: t("admin.viewDepartment"), icon: Eye },
    ...(onAddChild ? [{ id: "addChild" as const, label: t("admin.addSubDepartmentShort"), icon: Plus }] : []),
    ...(onDelete ? [{ id: "delete" as const, label: t("admin.deleteDepartment"), icon: TrashBin, danger: true }] : []),
  ];
  const run = (key: Key) => {
    if (key === "view") onOpen();
    else if (key === "addChild") onAddChild?.();
    else if (key === "delete") onDelete?.();
  };

  return (
    <Card role="article" aria-label={department.name}
      className={`relative min-w-0 gap-4 transition-colors hover:bg-default/40 ${department.isActive ? "" : "opacity-60"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${TINTS[department.id % TINTS.length]}`}>
          {initials(department.name)}
        </span>
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold">
          {/* The name covers the whole card, so a press anywhere opens it; the menu sits above. */}
          <button type="button" onClick={onOpen}
            className="text-start outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-focus">
            {department.name}
          </button>
        </h3>
        <Dropdown>
          <Dropdown.Trigger aria-label={t("admin.departmentActions").replace("{name}", department.name)}
            className="relative z-10 shrink-0 rounded-full p-1.5 text-muted hover:bg-default hover:text-foreground">
            <Ellipsis className="size-4" />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end">
            <Dropdown.Menu aria-label={t("admin.rowActions")} onAction={run}>
              {actions.map((action) => (
                <Dropdown.Item key={action.id} id={action.id} textValue={action.label} variant={action.danger ? "danger" : undefined}>
                  <action.icon className="size-4" />
                  {action.label}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-muted">
        <span className="truncate">
          {department.parentName ? t("admin.partOf").replace("{name}", department.parentName) : t("admin.topLevel")}
        </span>
        <span className="tabular-nums">
          {t("admin.departmentCounts")
            .replace("{members}", String(department.memberCount))
            .replace("{children}", String(department.childCount))}
        </span>
      </div>

      <div className="flex min-w-0 items-center justify-between gap-2">
        <Faces department={department} />
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {!department.isActive && <Chip size="sm" variant="soft" color="warning">{t("admin.inactive")}</Chip>}
          <Chip size="sm" variant="secondary">{department.code}</Chip>
        </div>
      </div>
    </Card>
  );
}

/** The first members' faces and how many more there are; nothing while the department is empty. */
function Faces({ department }: { department: DepartmentDto }) {
  const { t } = useLocale();
  const empty = department.memberCount === 0;
  const members = useGetDepartmentMembersQuery({ id: department.id, pageNumber: 1, pageSize: FACES }, { skip: empty });

  if (empty) return <span className="text-sm text-muted">{t("admin.noMembers")}</span>;
  if (!members.data) return <Skeleton className="h-8 w-20 rounded-full" />;
  const people = members.data.items;
  const others = members.data.totalCount - people.length;
  const names = people.map((person) => person.fullName).join(", ");
  return (
    <AvatarGroup size="sm" overlap="ring" role="img" aria-label={`${t("admin.members")}: ${names}${others > 0 ? ` +${others}` : ""}`} title={names}>
      {people.map((person) => <UserAvatar key={`${person.userId}-${person.positionId}`} fullName={person.fullName} />)}
      {/* A big department's count would not fit in the circle: the exact number is in the label and the card. */}
      {others > 0 && <AvatarGroup.Count>{others > 99 ? "99+" : `+${others}`}</AvatarGroup.Count>}
    </AvatarGroup>
  );
}

/** Words that say what kind of unit it is, skipped so the badge tells departments apart ("Phòng Kế toán" → "KT"). */
const KINDS = new Set(["phòng", "ban", "tổ", "nhóm", "bộ", "phận", "trung", "tâm", "khối", "department", "team"]);

/** Two letters for the round badge: the initials of the first two telling words, or the start of the only one. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const telling = words.filter((word) => !KINDS.has(word.toLocaleLowerCase("vi")));
  const chosen = telling.length > 0 ? telling : words;
  const letters = chosen.length === 1 ? chosen[0].slice(0, 2) : chosen.slice(0, 2).map((word) => word[0]).join("");
  return letters.toLocaleUpperCase("vi") || "?";
}
