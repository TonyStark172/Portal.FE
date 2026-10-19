"use client";

import type { Key } from "react";
import { Ellipsis } from "@gravity-ui/icons";
import { Dropdown, Label } from "@heroui/react";
import type { DepartmentAction, DepartmentActionItem } from "./departmentActions";

type Props = {
  items: DepartmentActionItem[];
  /** The accessible name of both the "⋯" button and the menu. */
  label: string;
  onAction: (action: DepartmentAction) => void;
};

/** The "⋯" button and menu of one department (on its card and in its details panel); render it only when there are items. */
export function DepartmentActionMenu({ items, label, onAction }: Props) {
  return (
    <Dropdown>
      <Dropdown.Trigger aria-label={label} className="rounded-full p-1 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus">
        <Ellipsis className="size-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={label} onAction={(key: Key) => onAction(key as DepartmentAction)}>
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
