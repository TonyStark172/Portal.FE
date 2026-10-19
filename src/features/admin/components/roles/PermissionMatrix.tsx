"use client";

import type { Key, ReactNode } from "react";
import { Copy, Ellipsis, Lock, Pencil, TrashBin } from "@gravity-ui/icons";
import { Checkbox, Chip, Dropdown, Label, Tooltip } from "@heroui/react";
import type { PermissionGroupDto, RoleDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { permissionDescription, permissionGroupLabel, permissionLabel } from "../../lib/permissionLabels";

type Props = {
  /** In display order: the administrator's role, the default one, then the rest by name. */
  roles: RoleDto[];
  groups: PermissionGroupDto[];
  /** What the matrix shows for a role: its saved permissions with the unsaved ticks applied. */
  permissionsOf: (role: RoleDto) => string[];
  /** Whether a cell differs from what is saved. */
  isChanged: (role: RoleDto, code: string) => boolean;
  onToggle: (role: RoleDto, code: string, on: boolean) => void;
  /** The boxes cannot change while a save is on its way. */
  isDisabled: boolean;
  onRename: (role: RoleDto) => void;
  onDuplicate: (role: RoleDto) => void;
  onDelete: (role: RoleDto) => void;
};

/**
 * Every permission (rows, grouped by module in catalogue order) against every role (columns), a checkbox in each cell.
 * It is one real table: the permission is the row header and the role the column header, so a screen reader announces
 * both for a cell. The permission names stick at the start and the role names at the top while it is scrolled, so it
 * works on a phone's width (it scrolls sideways) and with many roles. The administrator's column is all ticked and fixed.
 * Ticking changes the draft only; saving is the page's.
 */
export function PermissionMatrix({ roles, groups, permissionsOf, isChanged, onToggle, isDisabled, onRename, onDuplicate, onDelete }: Props) {
  const { t } = useLocale();
  const held = new Map(roles.map((role) => [role.id, new Set(permissionsOf(role))]));

  return (
    // Both ways scroll inside this box, so the sticky header row sticks to its top and not to the page's.
    <div className="max-h-[70vh] overflow-auto">
      <table aria-label={t("roles.tableLabel")} className="w-full min-w-max border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className="sticky start-0 top-0 z-20 min-w-56 border-b border-separator bg-surface px-4 py-3 text-start align-bottom text-xs font-medium uppercase text-muted">
              {t("roles.permission")}
            </th>
            {roles.map((role) => (
              <RoleHeader key={role.id} role={role} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.group}>
            <tr>
              <th scope="rowgroup" colSpan={roles.length + 1} className="border-b border-separator bg-default/60 px-4 py-2 text-start text-xs font-semibold uppercase text-muted">
                {/* The label stays at the start while the wide row is scrolled sideways. */}
                <div className="sticky start-4 w-fit">{permissionGroupLabel(group.group, t)}</div>
              </th>
            </tr>
            {group.permissions.map((code) => {
              const label = permissionLabel(code, t);
              const description = permissionDescription(code, t);
              return (
                <tr key={code}>
                  <th scope="row" className="sticky start-0 z-10 border-b border-separator bg-surface px-4 py-2.5 text-start font-normal">
                    <div className="font-medium">{label}</div>
                    {description && <div className="max-w-72 text-xs text-muted">{description}</div>}
                  </th>
                  {roles.map((role) => {
                    const changed = isChanged(role, code);
                    return (
                      <td
                        key={role.id}
                        data-changed={changed || undefined}
                        className={`border-b border-separator px-3 py-2.5 text-center transition-colors${changed ? " bg-accent/10" : ""}`}
                      >
                        <Checkbox
                          aria-label={t("roles.cell").replace("{permission}", label).replace("{role}", role.name)}
                          isSelected={held.get(role.id)?.has(code) ?? false}
                          isDisabled={role.isAdmin || isDisabled}
                          onChange={(on) => onToggle(role, code, on)}
                          className="justify-center"
                        >
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                          </Checkbox.Content>
                        </Checkbox>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

type HeaderProps = Pick<Props, "onRename" | "onDuplicate" | "onDelete"> & { role: RoleDto };

/** A role's column header: its name (the default one marked, the administrator's locked), how many people hold it, its menu. */
function RoleHeader({ role, onRename, onDuplicate, onDelete }: HeaderProps) {
  const { t } = useLocale();
  const items: { id: "rename" | "duplicate" | "delete"; label: string; icon: ReactNode; danger?: boolean }[] = [
    { id: "rename", label: t("roles.rename"), icon: <Pencil className="size-4 shrink-0 text-muted" /> },
    { id: "duplicate", label: t("admin.duplicate"), icon: <Copy className="size-4 shrink-0 text-muted" /> },
  ];
  if (!role.isDefault) items.push({ id: "delete", label: t("admin.delete"), icon: <TrashBin className="size-4 shrink-0 text-danger" />, danger: true });
  const act = (key: Key) => (key === "rename" ? onRename : key === "duplicate" ? onDuplicate : onDelete)(role);

  return (
    <th scope="col" className="sticky top-0 z-10 min-w-36 border-b border-separator bg-surface px-3 py-3 text-start align-top font-normal">
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="break-words text-sm font-semibold">{role.name}</span>
            {role.isAdmin && (
              <Tooltip delay={300}>
                <span role="img" tabIndex={0} aria-label={t("roles.alwaysAll")} className="rounded outline-none focus-visible:ring-2 focus-visible:ring-focus">
                  <Lock className="size-4 text-muted" />
                </span>
                <Tooltip.Content>{t("roles.alwaysAll")}</Tooltip.Content>
              </Tooltip>
            )}
          </div>
          {role.isDefault && (
            <Chip size="sm" variant="soft" color="accent" className="w-fit">
              {t("admin.defaultRole")}
            </Chip>
          )}
          <span className="text-xs font-normal tabular-nums text-muted">{t("admin.peopleCount").replace("{count}", String(role.userCount))}</span>
        </div>
        {!role.isAdmin && (
          <Dropdown>
            <Dropdown.Trigger
              aria-label={t("roles.menu").replace("{role}", role.name)}
              className="tap-target -me-1 shrink-0 rounded-full p-1.5 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
            >
              <Ellipsis className="size-4" />
            </Dropdown.Trigger>
            <Dropdown.Popover placement="bottom end">
              <Dropdown.Menu aria-label={t("roles.menu").replace("{role}", role.name)} onAction={act}>
                {items.map((item) => (
                  <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
                    {item.icon}
                    <Label>{item.label}</Label>
                  </Dropdown.Item>
                ))}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
      </div>
    </th>
  );
}
