"use client";

import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus } from "@gravity-ui/icons";
import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { DepartmentCard, type DepartmentAction, type DepartmentRights } from "./DepartmentCard";
import { useIsSelected, type SelectionStore } from "./selection";
import type { ChartTree } from "./tree";
import { useCardDrag } from "./useDepartmentDrag";

/**
 * What every branch of the chart shares, so it is passed down once instead of prop by prop. The object (and every
 * function in it) must stay the same between renders unless something really changed: the branches are memoised on it.
 * That is why the selection is a {@link SelectionStore} and not an id.
 */
export type ChartContext = {
  selection: SelectionStore;
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

// The zone between a parent's anchor point and the top of its children (h-12 / pt-12 = 3rem), where the curves are drawn.

type Curve = { id: number; d: string };
type Curves = { width: number; height: number; curves: Curve[] };

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * Measures where each child card's top centre is, relative to the wrapper, and turns it into a path from the wrapper's
 * top centre (the bottom of the parent's "+" button, or of its card): an S-shaped cubic Bezier with vertical tangents at
 * both ends, or a straight line when the child is right below. Everything is in the units `getBoundingClientRect`
 * reports, and the SVG's viewBox is that same box, so the drawing scales with the wrapper whatever the CSS zoom is.
 */
function measureCurves(wrapper: HTMLElement, list: HTMLElement): Curves {
  const box = wrapper.getBoundingClientRect();
  const startX = box.width / 2;
  let height = 0;
  const ends = Array.from(list.children).map((item) => {
    const card = item.querySelector("[data-department-id]") ?? item;
    const rect = card.getBoundingClientRect();
    const y = rect.top - box.top;
    height = Math.max(height, y);
    return { id: Number((item as HTMLElement).dataset.branchId), x: rect.left + rect.width / 2 - box.left, y };
  });
  const curves = ends.map(({ id, x, y }) => {
    const mid = round(y / 2);
    const d =
      Math.abs(x - startX) < 0.5
        ? `M${round(startX)} 0V${round(y)}`
        : `M${round(startX)} 0C${round(startX)} ${mid} ${round(x)} ${mid} ${round(x)} ${round(y)}`;
    return { id, d };
  });
  return { width: round(box.width), height: round(height), curves };
}

/**
 * A row of sibling branches joined to their parent by soft curves: from the bottom centre of the parent to the top
 * centre of each child, an S-shaped Bezier in an SVG laid over the zone above the row (a single child gets a straight
 * line). The SVG's viewBox is the measured box of that zone, so it follows the chart's CSS zoom by itself; the
 * measurement is repeated (ResizeObserver) when the row, a child or a subtree under it changes size, which covers
 * collapsing, the panel opening and a wide row. The SVG ignores the pointer, so cards, "+" buttons and dragging are
 * not affected.
 */
export const ChartChildren = memo(function ChartChildren({ trees, context }: { trees: ChartTree[]; context: ChartContext }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [drawing, setDrawing] = useState<Curves | null>(null);

  useLayoutEffect(() => {
    const root = wrapper.current;
    const row = list.current;
    if (!root || !row) return;
    const update = () => {
      const next = measureCurves(root, row);
      // Same drawing: keep the state, so the observer cannot start a render loop.
      setDrawing((current) => (current && JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    observer.observe(row);
    for (const item of Array.from(row.children)) observer.observe(item);
    return () => observer.disconnect();
  }, [trees]);

  return (
    <div ref={wrapper} className="relative">
      <svg
        aria-hidden
        data-connectors=""
        className="pointer-events-none absolute inset-x-0 top-0 h-12 w-full overflow-visible"
        viewBox={drawing ? `0 0 ${drawing.width} ${drawing.height}` : undefined}
        preserveAspectRatio="none"
      >
        {drawing?.curves.map(({ id, d }) => (
          <path
            key={id}
            d={d}
            data-connector-for={id}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            className="pointer-events-none stroke-muted/40"
          />
        ))}
      </svg>
      <ul ref={list} className="relative flex pt-12">
        {trees.map((tree) => (
          <li key={tree.node.id} data-branch-id={tree.node.id} className="flex flex-col items-center px-3">
            <ChartBranch tree={tree} context={context} />
          </li>
        ))}
      </ul>
    </div>
  );
});

/**
 * A department card with its "+" button and, unless collapsed, the branches of its sub-departments below. Memoised: a
 * branch renders again only when its own tree or the shared context changed, or when the selection or a drag touches
 * its card (it reads those itself).
 */
export const ChartBranch = memo(function ChartBranch({ tree, context }: { tree: ChartTree; context: ChartContext }) {
  const { t } = useLocale();
  const { node } = tree;
  const { selection, onSelect, onToggleCollapse, onAddChild } = context;
  const isSelected = useIsSelected(selection, node.id);
  const isCollapsed = context.collapsed.has(node.id);
  const showChildren = tree.children.length > 0 && !isCollapsed;
  const canAdd = context.rights.create && node.isActive;
  // Moving a department is an update of it; an inactive one may be moved, it just cannot receive a drop.
  const { rootRef, handleProps, dropState } = useCardDrag(node.id, context.rights.update);
  const dnd = useMemo(() => ({ rootRef, handleProps, dropState }), [rootRef, handleProps, dropState]);
  const select = useCallback(() => onSelect(node.id), [onSelect, node.id]);
  const toggleCollapse = useCallback(() => onToggleCollapse(node.id), [onToggleCollapse, node.id]);

  return (
    <div className="flex flex-col items-center">
      <DepartmentCard
        node={node}
        isSelected={isSelected}
        isMine={context.mine.has(node.id)}
        isCollapsed={isCollapsed}
        rights={context.rights}
        onSelect={select}
        onToggleCollapse={toggleCollapse}
        onMenuAction={context.onMenuAction}
        dnd={dnd}
      />
      {canAdd && <span className={`${LINE} h-3`} />}
      {canAdd && (
        <AddChildButton label={t("departments.addChild").replace("{name}", node.name)} onPress={() => onAddChild(node)} />
      )}
      {showChildren && <ChartChildren trees={tree.children} context={context} />}
    </div>
  );
});
