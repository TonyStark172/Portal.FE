import type { ReactNode } from "react";
import { ArrowRightArrowLeft, Pencil, PersonPlus, Plus, Power, TrashBin } from "@gravity-ui/icons";
import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";

/** What the "⋯" menu of a card (or of the details panel) can ask for; the parent opens the wizard or dialog that does it. */
export type DepartmentAction = "edit" | "addChild" | "addAlongside" | "transferIn" | "toggleActive" | "delete";

/** What the viewer may do to departments; a menu offers only the items its permission allows. */
export type DepartmentRights = { create: boolean; update: boolean; delete: boolean };

/** One item of a department's menu. */
export type DepartmentActionItem = { id: DepartmentAction; label: string; icon: ReactNode; danger?: boolean };

/**
 * The menu items of one department by what the viewer may do: edit / toggle need Update, "add a sub-department" needs
 * Create and an active department, adding or transferring staff in needs Update and an active department (an inactive
 * one cannot receive people), delete needs Delete. Shared by the card and the details panel so they always agree; an
 * empty list means there is nothing to offer (and no menu button at all).
 */
export function departmentActions(node: DepartmentChartNode, rights: DepartmentRights, t: (key: string) => string): DepartmentActionItem[] {
  const items: DepartmentActionItem[] = [];
  const icon = "size-4 shrink-0 text-muted";
  if (rights.update) items.push({ id: "edit", label: t("departments.action.edit"), icon: <Pencil className={icon} /> });
  if (rights.create && node.isActive) {
    items.push({ id: "addChild", label: t("departments.action.addChild"), icon: <Plus className={icon} /> });
  }
  if (rights.update && node.isActive) {
    items.push({ id: "addAlongside", label: t("departments.action.addAlongside"), icon: <PersonPlus className={icon} /> });
    items.push({ id: "transferIn", label: t("departments.action.transferIn"), icon: <ArrowRightArrowLeft className={icon} /> });
  }
  if (rights.update) {
    items.push({
      id: "toggleActive",
      label: t(node.isActive ? "departments.action.deactivate" : "departments.action.reactivate"),
      icon: <Power className={icon} />,
    });
  }
  if (rights.delete) {
    items.push({ id: "delete", label: t("departments.action.delete"), icon: <TrashBin className="size-4 shrink-0 text-danger" />, danger: true });
  }
  return items;
}
