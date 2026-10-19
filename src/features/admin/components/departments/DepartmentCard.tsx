"use client";

import { memo, type ComponentProps, type ReactNode, type Ref } from "react";
import { ChevronDown } from "@gravity-ui/icons";
import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { DepartmentActionMenu } from "./DepartmentActionMenu";
import { departmentActions, type DepartmentAction, type DepartmentRights } from "./departmentActions";
import { dropStateClass, type DropState } from "./useDepartmentDrag";

export type { DepartmentAction, DepartmentRights } from "./departmentActions";

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
  /** More to show under the headcount (the wizard preview adds the deputies here). */
  extra?: ReactNode;
  /** Makes the card a drag source and drop target: its root ref, the grip button's props (none: no grip) and drop look. */
  dnd?: { rootRef: Ref<HTMLDivElement>; handleProps: ComponentProps<"button"> | null; dropState: DropState | undefined };
};

/**
 * One department on the chart: a white card with its name, first head, headcount and, when it has sub-departments, a
 * green footer that collapses or expands them. Clicking the card selects it (the ring); the menu, the footer and
 * the ribbon do their own thing without also selecting. The card is a labelled group so it can be found by name, and
 * carries `data-department-id` for scrolling to it. An inactive department is faded and says so. Memoised: pass
 * stable callbacks and `rights`, or it renders for nothing.
 */
export const DepartmentCard = memo(function DepartmentCard({ node, isSelected, isMine, isCollapsed, rights, onSelect, onToggleCollapse, onMenuAction, extra, dnd }: DepartmentCardProps) {
  const { t } = useLocale();
  const head = node.heads[0];

  const items = departmentActions(node, rights, t);
  // The card being dragged leaves a light-blue dashed placeholder of its size behind (the copy under the pointer is the DragOverlay).
  const isLifted = dnd?.dropState === "dragged";

  return (
    <div
      ref={dnd?.rootRef}
      role="group"
      aria-label={node.name}
      aria-current={isSelected ? "true" : undefined}
      data-department-id={node.id}
      data-drop-state={dnd?.dropState}
      onClick={onSelect}
      className={`relative w-60 rounded-2xl border ${
        isLifted
          ? "border-dashed border-accent bg-accent/10 [&>*]:invisible"
          : `cursor-pointer bg-surface shadow-sm transition-shadow hover:shadow-md ${isSelected ? "border-accent ring-2 ring-accent" : "border-border"} ${
              node.isActive ? "" : "opacity-60"
            } ${dropStateClass(dnd?.dropState)}`
      }`}
    >
      {isMine && (
        <span className="absolute -top-2.5 left-4 rounded-md bg-accent px-2 py-0.5 text-[11px] font-medium leading-none text-accent-foreground shadow-sm">
          {t("departments.yours")}
        </span>
      )}
      {!node.isActive && (
        // A ribbon on the top edge, like "Phòng của bạn", so an inactive card keeps the height of the others.
        <span className="absolute -top-2.5 right-4 rounded-md border border-border bg-surface-secondary px-2 py-0.5 text-[11px] font-medium leading-none text-muted shadow-sm">
          {t("departments.inactive")}
        </span>
      )}

      <div className="flex flex-col gap-2 p-3 pt-4">
        <div className="flex items-start justify-between gap-1">
          {dnd?.handleProps && (
            // The grip: pressing and moving 6 px lifts the card; Space lifts it from the keyboard. A click on it is not a selection.
            <button
              type="button"
              {...dnd.handleProps}
              aria-label={t("departments.drag.handle").replace("{name}", node.name)}
              onClick={(event) => event.stopPropagation()}
              className="-ml-1 shrink-0 cursor-grab touch-none rounded px-0.5 text-sm leading-6 tracking-tighter text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus active:cursor-grabbing"
            >
              <span aria-hidden="true">⋮⋮</span>
            </button>
          )}
          {/* A real button, so the keyboard can select the card; its click bubbles to the card's handler. */}
          {/* One line (the full name in the tooltip), so every card on the chart has the same height. */}
          <button type="button" title={node.name} className="min-w-0 flex-1 rounded text-left text-sm font-semibold leading-6 outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <span className="block truncate">{node.name}</span>
          </button>
          {items.length > 0 && (
            // The menu's popover is portalled, but React still bubbles its clicks here; stop them selecting the card.
            <span onClick={(event) => event.stopPropagation()}>
              <DepartmentActionMenu
                items={items}
                label={t("departments.menu").replace("{name}", node.name)}
                onAction={(action) => onMenuAction(action, node)}
              />
            </span>
          )}
        </div>

        {/* The head row is as tall with or without a head (the avatar's height), so cards line up. */}
        {head ? (
          <div className="flex h-8 items-center gap-2 text-sm">
            <UserAvatar fullName={head.fullName} avatarUrl={head.avatarUrl} size="sm" />
            <span className="min-w-0 truncate">{head.fullName}</span>
            {node.headCount > 1 && <span className="shrink-0 text-xs text-muted">+{node.headCount - 1}</span>}
          </div>
        ) : (
          <p className="flex h-8 items-center text-sm text-muted">{t("departments.noHead")}</p>
        )}

        <p className="text-xs text-muted">{t("departments.memberCount").replace("{count}", String(node.memberCount))}</p>
        {extra}
      </div>

      {node.childCount > 0 ? (
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
      ) : (
        // The footer is always there (same height as the button above), so a card without sub-departments is not shorter.
        <p className="flex w-full items-center rounded-b-2xl bg-default/40 px-3 py-2 text-xs text-muted">
          <span className="leading-4">{t("departments.noChildren")}</span>
        </p>
      )}
    </div>
  );
});
