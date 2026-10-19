"use client";

import { Plus } from "@gravity-ui/icons";
import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { DepartmentCard, type DepartmentAction, type DepartmentRights } from "./DepartmentCard";
import type { ChartTree } from "./tree";

/** What every branch of the chart shares, so it is passed down once instead of prop by prop. */
export type ChartContext = {
  selectedId: number | null;
  /** Ids of the viewer's own departments. */
  mine: ReadonlySet<number>;
  collapsed: ReadonlySet<number>;
  rights: DepartmentRights;
  onSelect: (id: number) => void;
  onToggleCollapse: (id: number) => void;
  /** `null` adds a top-level department (the "+" under the organization card). */
  onAddChild: (parent: DepartmentChartNode | null) => void;
  onMenuAction: (action: DepartmentAction, node: DepartmentChartNode) => void;
};

/** The thin line between a card, its "+" and the row of its children. */
const LINE = "block w-px bg-border";

/**
 * The round "+" under a card, centred on the connector line. `label` is its accessible name; the caller decides
 * whether to render it at all (it needs Departments.Create and an active parent).
 */
export function AddChildButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onPress}
      className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm outline-none hover:border-accent hover:text-accent focus-visible:ring-2 focus-visible:ring-focus"
    >
      <Plus className="size-3.5" />
    </button>
  );
}

/**
 * A row of sibling branches joined by elbow connectors: each child hangs from a short vertical line, and a horizontal
 * line runs along the top of the row (from the middle of the first child to the middle of the last, so a single child
 * has none). Drawn with absolutely positioned hairlines rather than an SVG, because each segment is just a line and
 * the layout (flex) already knows where every card is.
 */
export function ChartChildren({ trees, context }: { trees: ChartTree[]; context: ChartContext }) {
  return (
    <ul className="flex">
      {trees.map((tree, index) => (
        <li key={tree.node.id} className="relative flex flex-col items-center px-3 pt-4">
          <span className={`${LINE} absolute left-1/2 top-0 h-4`} />
          {trees.length > 1 && (
            <span
              className={`absolute top-0 block h-px bg-border ${
                index === 0 ? "left-1/2 right-0" : index === trees.length - 1 ? "left-0 right-1/2" : "left-0 right-0"
              }`}
            />
          )}
          <ChartBranch tree={tree} context={context} />
        </li>
      ))}
    </ul>
  );
}

/** A department card with its "+" button and, unless collapsed, the branches of its sub-departments below. */
export function ChartBranch({ tree, context }: { tree: ChartTree; context: ChartContext }) {
  const { t } = useLocale();
  const { node } = tree;
  const isCollapsed = context.collapsed.has(node.id);
  const showChildren = tree.children.length > 0 && !isCollapsed;
  const canAdd = context.rights.create && node.isActive;

  return (
    <div className="flex flex-col items-center">
      <DepartmentCard
        node={node}
        isSelected={context.selectedId === node.id}
        isMine={context.mine.has(node.id)}
        isCollapsed={isCollapsed}
        rights={context.rights}
        onSelect={() => context.onSelect(node.id)}
        onToggleCollapse={() => context.onToggleCollapse(node.id)}
        onMenuAction={context.onMenuAction}
      />
      {(canAdd || showChildren) && <span className={`${LINE} h-3`} />}
      {canAdd && (
        <AddChildButton label={t("departments.addChild").replace("{name}", node.name)} onPress={() => context.onAddChild(node)} />
      )}
      {canAdd && showChildren && <span className={`${LINE} h-3`} />}
      {showChildren && <ChartChildren trees={tree.children} context={context} />}
    </div>
  );
}
