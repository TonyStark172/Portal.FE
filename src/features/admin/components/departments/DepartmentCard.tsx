"use client";

import type { Key, ReactNode } from "react";
import { ArrowRightArrowLeft, ChevronDown, Ellipsis, Pencil, PersonPlus, Plus, Power, TrashBin } from "@gravity-ui/icons";
import { Chip, Dropdown, Label } from "@heroui/react";
import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";

/** What the "⋯" menu of a card can ask for; the parent (later tasks) opens the wizard or dialog that does it. */
export type DepartmentAction = "edit" | "addChild" | "addAlongside" | "transferIn" | "toggleActive" | "delete";

/** What the viewer may do to departments; a card offers only the menu items its permission allows. */
export type DepartmentRights = { create: boolean; update: boolean; delete: boolean };

type DepartmentCardProps = {
  node: DepartmentChartNode;
  isSelected: boolean;
  /** The viewer belongs to this department (it gets the "Phòng của bạn" ribbon). */
  isMine: boolean;
  /** The cards below it are hidden. */
  isCollapsed: boolean;
  rights: DepartmentRights;
  onSelect: () => void;
  onToggleCollapse: () => void;
  onMenuAction: (action: DepartmentAction, node: DepartmentChartNode) => void;
};

/**
 * One department on the chart: a white card with its name, first head, headcount and, when it has sub-departments, a
 * green footer that collapses or expands them. Clicking the card selects it (the ring); the menu, the footer and
 * the ribbon do their own thing without also selecting. The card is a labelled group so it can be found by name, and
 * carries `data-department-id` for scrolling to it. An inactive department is faded and says so.
 */
export function DepartmentCard({ node, isSelected, isMine, isCollapsed, rights, onSelect, onToggleCollapse, onMenuAction }: DepartmentCardProps) {
  const { t } = useLocale();
  const head = node.heads[0];

  const items: { id: DepartmentAction; label: string; icon: ReactNode; danger?: boolean }[] = [];
  const icon = "size-4 shrink-0 text-muted";
  if (rights.update) items.push({ id: "edit", label: t("departments.action.edit"), icon: <Pencil className={icon} /> });
  if (rights.create && node.isActive) {
    items.push({ id: "addChild", label: t("departments.action.addChild"), icon: <Plus className={icon} /> });
  }
  // An inactive department cannot receive people, so only an active one offers to add or transfer staff in.
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

  return (
    <div
      role="group"
      aria-label={node.name}
      aria-current={isSelected ? "true" : undefined}
      data-department-id={node.id}
      onClick={onSelect}
      className={`relative w-60 cursor-pointer rounded-2xl border bg-surface shadow-sm transition-shadow hover:shadow-md ${
        isSelected ? "border-accent ring-2 ring-accent" : "border-border"
      } ${node.isActive ? "" : "opacity-60"}`}
    >
      {isMine && (
        <span className="absolute -top-2.5 left-4 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium leading-none text-accent-foreground shadow-sm">
          {t("departments.yours")}
        </span>
      )}

      <div className="flex flex-col gap-2 p-3 pt-4">
        <div className="flex items-start justify-between gap-1">
          {/* A real button, so the keyboard can select the card; its click bubbles to the card's handler. */}
          <button type="button" className="min-w-0 flex-1 rounded text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <span className="line-clamp-2 break-words">{node.name}</span>
          </button>
          {items.length > 0 && (
            // The menu's popover is portalled, but React still bubbles its clicks here; stop them selecting the card.
            <span onClick={(event) => event.stopPropagation()}>
              <Dropdown>
                <Dropdown.Trigger
                  aria-label={t("departments.menu").replace("{name}", node.name)}
                  className="rounded-full p-1 text-muted outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
                >
                  <Ellipsis className="size-4" />
                </Dropdown.Trigger>
                <Dropdown.Popover placement="bottom end">
                  <Dropdown.Menu
                    aria-label={t("departments.menu").replace("{name}", node.name)}
                    onAction={(key: Key) => onMenuAction(key as DepartmentAction, node)}
                  >
                    {items.map((item) => (
                      <Dropdown.Item key={item.id} id={item.id} textValue={item.label} variant={item.danger ? "danger" : undefined}>
                        {item.icon}
                        <Label>{item.label}</Label>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            </span>
          )}
        </div>

        {!node.isActive && (
          <div>
            <Chip size="sm" variant="secondary">{t("departments.inactive")}</Chip>
          </div>
        )}

        {head ? (
          <div className="flex items-center gap-2 text-sm">
            <UserAvatar fullName={head.fullName} avatarUrl={head.avatarUrl} size="sm" />
            <span className="min-w-0 truncate">{head.fullName}</span>
            {node.headCount > 1 && <span className="shrink-0 text-xs text-muted">+{node.headCount - 1}</span>}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("departments.noHead")}</p>
        )}

        <p className="text-xs text-muted">{t("departments.memberCount").replace("{count}", String(node.memberCount))}</p>
      </div>

      {node.childCount > 0 && (
        <button
          type="button"
          aria-expanded={!isCollapsed}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse();
          }}
          className="flex w-full items-center justify-between rounded-b-2xl bg-success/10 px-3 py-2 text-xs font-medium text-success outline-none hover:bg-success/20 focus-visible:ring-2 focus-visible:ring-focus"
        >
          {t("departments.childCount").replace("{count}", String(node.childCount))}
          <ChevronDown className={`size-4 transition-transform ${isCollapsed ? "" : "rotate-180"}`} />
        </button>
      )}
    </div>
  );
}
