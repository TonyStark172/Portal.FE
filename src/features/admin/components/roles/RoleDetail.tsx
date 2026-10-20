"use client";

import { Fragment, useId, type Key, type ReactNode } from "react";
import { ArrowRotateLeft, Copy, Ellipsis, Lock, Pencil, TrashBin } from "@gravity-ui/icons";
import { Button, Checkbox, Chip, Dropdown, Label } from "@heroui/react";
import type { PermissionGroupDto, RoleDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { permissionDescription, permissionGroupLabel, permissionLabel } from "../../lib/permissionLabels";

type Props = {
  role: RoleDto;
  groups: PermissionGroupDto[];
  /** What the role holds as shown: its saved permissions with the unsaved ticks applied. */
  held: string[];
  /** Whether a permission differs from what is saved. */
  isChanged: (code: string) => boolean;
  changeCount: number;
  isSaving: boolean;
  onSet: (codes: string[], on: boolean) => void;
  onReset: () => void;
  onSave: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Shown above the header on a narrow screen, where the list is not: the role picker. */
  picker: ReactNode;
};

/**
 * The right pane: the role shown (name, marks, people, its menu), its permissions grouped by module in
 * catalogue order, and a footer to save or reset them. The permissions scroll on their own between the header and the
 * footer, each group's header staying at the top while its rows pass under it.
 *
 * Every band (picker, header, group headers, rows, footer) shares one left edge, the boxes' column, so the boxes line up
 * from group to group and the labels start at one place. A row is one big target: the whole of it toggles its box.
 *
 * The picker stays mounted from role to role (it keeps the keyboard focus after a pick); what is below it is drawn anew for
 * each role, so the permissions start scrolled to the top.
 */
export function RoleDetail({ role, groups, held, isChanged, changeCount, isSaving, onSet, onReset, onSave, onRename, onDuplicate, onDelete, picker }: Props) {
  const { t } = useLocale();
  const headingId = useId();
  const holds = new Set(held);
  // Only the administrator's boxes are fixed. While a save is on its way a press is ignored by the draft, rather than every
  // box being disabled (which would make the list flash on each save).
  const isFixed = role.isAdmin;
  const hasChanges = changeCount > 0;

  return (
    <section aria-labelledby={headingId} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {picker}

      <Fragment key={role.id}>
      <header className="flex items-start gap-3 border-b border-separator px-4 py-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={headingId} className="min-w-0 break-words text-base font-semibold">
              {role.name}
            </h3>
            {role.isDefault && (
              <Chip size="sm" variant="soft" color="accent">
                {t("admin.defaultRole")}
              </Chip>
            )}
            <span aria-hidden className="text-muted">
              ·
            </span>
            <span className="text-sm tabular-nums text-muted">{t("admin.peopleCount").replace("{count}", String(role.userCount))}</span>
          </div>
          {role.isAdmin && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Lock aria-hidden className="size-4 shrink-0" />
              {t("roles.adminNote")}
            </p>
          )}
        </div>
        {!role.isAdmin && <RoleMenu role={role} onRename={onRename} onDuplicate={onDuplicate} onDelete={onDelete} />}
      </header>

      <div data-pane="permissions" className="min-h-0 flex-1 scrollbar overflow-y-auto overscroll-contain">
        {groups.map((group) => (
          <PermissionGroup key={group.group} group={group} holds={holds} isChanged={isChanged} isFixed={isFixed} onSet={onSet} />
        ))}
      </div>

      {!role.isAdmin && (
        <div
          role="region"
          aria-label={t("roles.saveBar")}
          className="flex flex-wrap items-center justify-end gap-3 border-t border-separator bg-surface px-4 py-3"
        >
          <p aria-live="polite" className="me-auto text-sm tabular-nums text-muted">
            {hasChanges ? t("roles.pending").replace("{count}", String(changeCount)) : t("roles.noPending")}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" isDisabled={!hasChanges || isSaving} onPress={onReset}>
              <ArrowRotateLeft className="size-4" />
              {t("roles.reset")}
            </Button>
            <Button isDisabled={!hasChanges} isPending={isSaving} onPress={onSave}>
              {t("roles.save")}
            </Button>
          </div>
        </div>
      )}
      </Fragment>
    </section>
  );
}

type GroupProps = {
  group: PermissionGroupDto;
  holds: Set<string>;
  isChanged: (code: string) => boolean;
  isFixed: boolean;
  onSet: (codes: string[], on: boolean) => void;
};

/** A module's permissions under its name, with a "select all" box that is partly ticked while only some of them are. */
function PermissionGroup({ group, holds, isChanged, isFixed, onSet }: GroupProps) {
  const { t } = useLocale();
  const idPrefix = useId();
  const label = permissionGroupLabel(group.group, t);
  const count = group.permissions.filter((code) => holds.has(code)).length;
  const all = count === group.permissions.length && count > 0;

  return (
    <section data-group={group.group} aria-labelledby={`${idPrefix}-group`}>
      <div className="sticky top-0 z-10 flex min-h-11 items-center gap-3 border-b border-separator bg-surface-secondary px-4 py-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h4 id={`${idPrefix}-group`} className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
            {label}
          </h4>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {count}/{group.permissions.length}
          </span>
        </div>
        <Checkbox
          aria-label={t("roles.selectAllOf").replace("{group}", label)}
          isSelected={all}
          isIndeterminate={count > 0 && !all}
          isDisabled={isFixed}
          onChange={(on) => onSet(group.permissions, on)}
          className="group shrink-0 data-[disabled=true]:opacity-100"
        >
          <Checkbox.Content className="cursor-pointer gap-2 text-xs font-medium text-muted">
            <Checkbox.Control className="group-data-[disabled=true]:opacity-50">
              <Checkbox.Indicator />
            </Checkbox.Control>
            {t("roles.selectAll")}
          </Checkbox.Content>
        </Checkbox>
      </div>

      <ul>
        {group.permissions.map((code) => {
          const name = permissionLabel(code, t);
          const description = permissionDescription(code, t);
          const changed = isChanged(code);
          return (
            <li
              key={code}
              data-permission={code}
              data-changed={changed || undefined}
              // A changed row is told apart by a bar at its start and a word, as well as a tint (colour alone is not a cue).
              className={`relative border-b border-separator transition-colors last:border-b-0${changed ? " bg-accent/5" : ""}`}
            >
              <Checkbox
                aria-label={changed ? t("roles.changed").replace("{permission}", name) : name}
                aria-describedby={description ? `${idPrefix}-${code}` : undefined}
                isSelected={holds.has(code)}
                isDisabled={isFixed}
                onChange={(on) => onSet([code], on)}
                // The administrator's rows stay readable: only the box is dimmed.
                className="group w-full data-[disabled=true]:opacity-100"
              >
                {/* The whole row is the label, so the whole row toggles (at least 44px high). */}
                <Checkbox.Content className="flex min-h-11 w-full cursor-pointer items-start gap-3 px-4 py-3 hover:bg-default/40">
                  {/* Nudged down to sit on the first line of the label (a 16px box on a 20px line). */}
                  <Checkbox.Control className="mt-0.5 group-data-[disabled=true]:opacity-50">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span data-slot="permission-label" className="text-sm font-medium">
                      {name}
                    </span>
                    {description && (
                      <span id={`${idPrefix}-${code}`} className="text-xs font-normal text-muted">
                        {description}
                      </span>
                    )}
                  </span>
                  {changed && (
                    <Chip aria-hidden size="sm" variant="soft" color="accent" className="shrink-0">
                      {t("roles.unsaved")}
                    </Chip>
                  )}
                </Checkbox.Content>
              </Checkbox>
              {/* Positioned, so it is drawn over the row's hover background. */}
              {changed && <span data-slot="changed-bar" aria-hidden className="pointer-events-none absolute inset-y-0 start-0 w-1 bg-accent" />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

type MenuProps = { role: RoleDto; onRename: () => void; onDuplicate: () => void; onDelete: () => void };

/** The role's "⋯" menu: rename, duplicate, and delete (not the default role, which new people get). */
function RoleMenu({ role, onRename, onDuplicate, onDelete }: MenuProps) {
  const { t } = useLocale();
  const items: { id: "rename" | "duplicate" | "delete"; label: string; icon: ReactNode; danger?: boolean }[] = [
    { id: "rename", label: t("roles.rename"), icon: <Pencil className="size-4 shrink-0 text-muted" /> },
    { id: "duplicate", label: t("admin.duplicate"), icon: <Copy className="size-4 shrink-0 text-muted" /> },
  ];
  if (!role.isDefault) items.push({ id: "delete", label: t("admin.delete"), icon: <TrashBin className="size-4 shrink-0 text-danger" />, danger: true });
  const act = (key: Key) => (key === "rename" ? onRename : key === "duplicate" ? onDuplicate : onDelete)();
  const label = t("roles.menu").replace("{role}", role.name);

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={label}
        className="tap-target -me-2 shrink-0 rounded-full p-2 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Ellipsis className="size-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={label} onAction={act}>
          {items.map((item) => (
            <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
              {item.icon}
              <Label>{item.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
