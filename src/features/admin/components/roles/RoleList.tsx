"use client";

import { useState } from "react";
import { Lock, Plus } from "@gravity-ui/icons";
import { Button, Chip, Label, ListBox, SearchField, Select } from "@heroui/react";
import type { RoleDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { matchesVietnamese } from "@/shared/lib/vietnameseSearch";

type Props = {
  /** In display order: the administrator's role, the default one, then the rest by name. */
  roles: RoleDto[];
  selectedId: number;
  /** Whether a role has unsaved changes (only the role shown can, but the list says which). */
  isDirty: (role: RoleDto) => boolean;
  onSelect: (role: RoleDto) => void;
  onCreate: () => void;
};

/**
 * The left pane, from a medium screen up: a search by name, the roles (the one shown is highlighted and marked as current),
 * and "Tạo vai trò" kept at the bottom. It scrolls on its own, the search and the button staying in place.
 */
export function RoleList({ roles, selectedId, isDirty, onSelect, onCreate }: Props) {
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const found = roles.filter((role) => matchesVietnamese(role.name, search));

  return (
    <div data-pane="list" className="hidden min-h-0 w-64 shrink-0 flex-col overflow-y-auto overscroll-contain border-e border-separator md:flex">
      <div className="sticky top-0 z-10 bg-surface p-3">
        <SearchField aria-label={t("roles.search")} value={search} onChange={setSearch} variant="secondary" fullWidth>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input placeholder={t("roles.search")} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      </div>

      <ul aria-label={t("roles.list")} className="flex flex-1 flex-col gap-1 px-3 pb-3">
        {found.map((role) => (
          <li key={role.id}>
            <RoleItem role={role} isSelected={role.id === selectedId} isDirty={isDirty(role)} onSelect={onSelect} />
          </li>
        ))}
        {found.length === 0 && <li className="px-3 py-2 text-sm text-muted">{t("roles.noMatch")}</li>}
      </ul>

      <div className="sticky bottom-0 z-10 border-t border-separator bg-surface p-3">
        <Button variant="secondary" fullWidth onPress={onCreate}>
          <Plus className="size-4" />
          {t("admin.createRole")}
        </Button>
      </div>
    </div>
  );
}

type ItemProps = { role: RoleDto; isSelected: boolean; isDirty: boolean; onSelect: (role: RoleDto) => void };

/** One role: its name (the administrator's locked, the default one marked), how many people hold it, a dot while unsaved. */
function RoleItem({ role, isSelected, isDirty, onSelect }: ItemProps) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(role)}
      className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-start outline-none transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-focus aria-[current=true]:bg-accent-soft aria-[current=true]:text-accent-soft-foreground"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{role.name}</span>
          {role.isAdmin && (
            <span role="img" aria-label={t("roles.alwaysAll")} className="shrink-0">
              <Lock className="size-3.5 text-muted" />
            </span>
          )}
          {role.isDefault && (
            <Chip size="sm" variant="soft" color="accent" className="shrink-0">
              {t("admin.defaultRole")}
            </Chip>
          )}
        </span>
        <span className="text-xs tabular-nums text-muted">{t("admin.peopleCount").replace("{count}", String(role.userCount))}</span>
      </span>
      {isDirty && (
        <>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
          <span className="sr-only">{t("roles.unsavedMark")}</span>
        </>
      )}
    </button>
  );
}

type PickerProps = Pick<Props, "roles" | "selectedId" | "onCreate"> & { onSelect: (id: number) => void };

/** The list's stand-in below a medium screen: "Vai trò: [role ▾]" and "Tạo vai trò", above the role's pane. */
export function RolePicker({ roles, selectedId, onSelect, onCreate }: PickerProps) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-2 border-b border-separator px-4 py-3 md:hidden">
      <Select
        className="flex min-w-0 flex-1 flex-row items-center gap-2"
        selectedKey={String(selectedId)}
        onSelectionChange={(key) => key !== null && onSelect(Number(key))}
      >
        <Label className="shrink-0 text-sm font-medium">{t("roles.picker")}</Label>
        <Select.Trigger className="min-w-0 flex-1">
          <Select.Value className="truncate" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {roles.map((role) => (
              <ListBox.Item id={String(role.id)} key={role.id} textValue={role.name}>
                {role.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Button variant="secondary" className="shrink-0" onPress={onCreate}>
        <Plus className="size-4" />
        {t("admin.createRole")}
      </Button>
    </div>
  );
}
