"use client";

import { FieldError, Label, ListBox, Select } from "@heroui/react";
import type { DepartmentTreeNode } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { flatten } from "../../lib/departmentTree";

/** Key of the "no parent" option (a real id is never "top"). */
const TOP = "top";

type Props = {
  tree: DepartmentTreeNode[];
  value: number | null;
  onChange: (parentId: number | null) => void;
  /** Departments it may not go under (a department itself and everything below it). */
  excluded?: Set<number>;
  isDisabled?: boolean;
};

/** Which department this one is part of: the top level, or any department of the tree, indented by depth. */
export function ParentSelect({ tree, value, onChange, excluded, isDisabled }: Props) {
  const { t } = useLocale();
  const options = [
    { id: TOP, name: t("admin.noParent"), depth: 0 },
    ...flatten(tree)
      .filter(({ node }) => !excluded?.has(node.id))
      .map(({ node, depth }) => ({ id: String(node.id), name: node.name, depth })),
  ];

  return (
    <Select fullWidth variant="secondary" isDisabled={isDisabled} name="parentId"
      selectedKey={value === null ? TOP : String(value)}
      onSelectionChange={(key) => key !== null && onChange(key === TOP ? null : Number(key))}>
      <Label>{t("admin.parentDepartment")}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => (
            <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
              <span style={{ paddingInlineStart: `${option.depth * 12}px` }}>{option.name}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      <FieldError />
    </Select>
  );
}
