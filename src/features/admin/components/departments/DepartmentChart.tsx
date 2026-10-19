"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Button } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import type { DepartmentChartDto, DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { NumberStepper } from "@/shared/ui/NumberStepper";
import { AddChildButton, ChartChildren, type ChartContext } from "./ChartBranch";
import { DepartmentCard, type DepartmentAction } from "./DepartmentCard";
import { OrganizationCard } from "./OrganizationCard";
import { createSelectionStore } from "./selection";
import { ancestorIds, buildChartTree } from "./tree";
import { DragStateProvider, useDepartmentDrag } from "./useDepartmentDrag";

export type { DepartmentAction } from "./DepartmentCard";

const noop = () => {};

/**
 * A function that never changes identity but always calls the latest `fn`, so a parent's inline callbacks do not
 * wake the memoised branches of the chart.
 */
function useStableCallback<Args extends unknown[], Result>(fn: (...args: Args) => Result): (...args: Args) => Result {
  const latest = useRef(fn);
  useLayoutEffect(() => {
    latest.current = fn;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}

const ZOOM_MIN = 50;
const ZOOM_MAX = 150;
const ZOOM_STEP = 10;
/** How long the highlight pulse stays on a card. */
const PULSE_MS = 2200;

type DepartmentChartProps = {
  chart: DepartmentChartDto;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** The "+" under a card; `null` is the "+" under the organization card (a top-level department). */
  onAddChild: (parent: DepartmentChartNode | null) => void;
  onMenuAction: (action: DepartmentAction, node: DepartmentChartNode) => void;
  /** The company's slogan, shown under its name on the organization card (the chart itself does not carry it). */
  organizationSlogan?: string | null;
  /** The organization card's "Sửa thông tin công ty" (offered only to someone with Organization.Update). */
  onEditOrganization?: () => void;
  /**
   * Asks the chart to bring a card into view: open its collapsed ancestors and scroll it to the middle. A new
   * `request` number asks again (also for the same id). The card may not exist yet (a department just created is
   * drawn after the chart refetches): the chart waits for it. Selecting it is the parent's business. With `pulse`
   * the card also gets a short highlight pulse once it is in view.
   */
  focusRequest?: { id: number; request: number; pulse?: boolean } | null;
};

/**
 * The org chart canvas: the organization card on top and the departments below it as a tree of cards, on a pannable
 * (scrolling) light canvas. Which cards are collapsed and the zoom level are the canvas's own state; the selection
 * belongs to the parent (the drawer and dialogs of later tasks read it). "Find me" opens every collapsed ancestor of
 * the viewer's first department, selects it and scrolls it to the middle. Zoom uses CSS `zoom` rather than a
 * transform, so the scroll area follows the zoomed size. With Departments.Update a card can be dragged by its grip
 * onto another card (or the organization card) to move it ({@link useDepartmentDrag}); the lifted card is shown by a
 * copy of the card, tilted and shadowed, that follows the pointer (drawn outside the zoomed area and scaled to the zoom
 * level by hand), while the card's own place shows a dashed placeholder.
 */
export function DepartmentChart({ chart, selectedId, onSelect: onSelectProp, onAddChild: onAddChildProp, onMenuAction: onMenuActionProp, onEditOrganization, organizationSlogan, focusRequest }: DepartmentChartProps) {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const [zoom, setZoom] = useState(100);
  // A counter, so asking for the same card twice scrolls twice; the effect below runs after the cards were expanded.
  const [scrollTo, setScrollTo] = useState<{ id: number; request: number; pulse: boolean } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  // The last focus request that was carried out (state adjusted while rendering, the way React documents it).
  const [handledFocus, setHandledFocus] = useState(0);

  // The organization profile may not be saved yet, and then its name is empty: the top card still needs a name.
  const organizationName = chart.organizationName.trim() || t("departments.organizationFallback");
  const trees = useMemo(() => buildChartTree(chart.departments), [chart.departments]);
  const mine = useMemo(() => new Set(chart.myDepartmentIds), [chart.myDepartmentIds]);
  const myFirst = chart.myDepartmentIds.find((id) => chart.departments.some((d) => d.id === id));
  const canCreate = hasPermission(Permissions.Departments.Create);
  const canUpdate = hasPermission(Permissions.Departments.Update);
  const canDelete = hasPermission(Permissions.Departments.Delete);
  const canEditOrganization = hasPermission(Permissions.Organization.Update);
  const rights = useMemo(() => ({ create: canCreate, update: canUpdate, delete: canDelete }), [canCreate, canUpdate, canDelete]);
  // The parent's callbacks may be new on every render; the branches get ones that never change.
  const onSelect = useStableCallback(onSelectProp);
  const onAddChild = useStableCallback(onAddChildProp);
  const onMenuAction = useStableCallback(onMenuActionProp);
  // The selection lives in a store the cards subscribe to (see SelectionStore), fed from the prop.
  const [selection] = useState(() => createSelectionStore(selectedId));
  useLayoutEffect(() => selection.set(selectedId), [selection, selectedId]);

  // A focus request waits for its card to be in the chart, then opens the way to it and scrolls to it as "find me" does.
  if (focusRequest && focusRequest.request !== handledFocus && chart.departments.some((d) => d.id === focusRequest.id)) {
    setHandledFocus(focusRequest.request);
    reveal(focusRequest.id, focusRequest.pulse);
  }

  useEffect(() => {
    if (!scrollTo) return;
    const card = canvas.current?.querySelector(`[data-department-id="${scrollTo.id}"]`);
    card?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    if (!card || !scrollTo.pulse) return;
    // The pulse is an attribute on the card for a moment (a CSS animation, or a still outline with reduced motion). An
    // attribute and not a class: React rewrites the card's class list whenever its selection state changes.
    card.setAttribute("data-pulse", "");
    const timer = setTimeout(() => card.removeAttribute("data-pulse"), PULSE_MS);
    return () => {
      clearTimeout(timer);
      card.removeAttribute("data-pulse");
    };
  }, [scrollTo]);

  const toggle = useCallback((id: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /** Opens every collapsed ancestor of the card and scrolls it to the middle (the scroll runs after it was drawn). */
  function reveal(id: number, pulse = false) {
    const parents = new Set(ancestorIds(chart.departments, id));
    setCollapsed((current) => new Set([...current].filter((other) => !parents.has(other))));
    setScrollTo((current) => ({ id, request: (current?.request ?? 0) + 1, pulse }));
  }

  function findMe() {
    if (myFirst === undefined) return;
    onSelect(myFirst);
    reveal(myFirst);
  }

  const dnd = useDepartmentDrag({ nodes: chart.departments, organizationName, canvas });
  const accessibility = useMemo(
    () => ({ announcements: dnd.announcements, screenReaderInstructions: { draggable: dnd.instructions } }),
    [dnd.announcements, dnd.instructions],
  );

  // Changes only with the collapsed set, the viewer's departments or rights: not with selection, zoom or dragging.
  const context: ChartContext = useMemo(
    () => ({ selection, mine, collapsed, rights, onSelect, onToggleCollapse: toggle, onAddChild, onMenuAction }),
    [selection, mine, collapsed, rights, onSelect, toggle, onAddChild, onMenuAction],
  );

  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      accessibility={accessibility}
      onDragStart={dnd.onDragStart}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
    >
      <DragStateProvider value={dnd.drag}>
        <div className="relative h-full min-h-96 rounded-2xl border border-border bg-surface-secondary">
          {/* A focusable region, so its name is announced and the keyboard can scroll (pan) the canvas. */}
          <div ref={canvas} role="region" tabIndex={0} aria-label={t("departments.chart")} className="h-full min-h-96 overflow-auto rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <div className="flex w-max min-w-full flex-col items-center p-8 pb-20" style={{ zoom: zoom / 100 }}>
              <OrganizationCard name={organizationName} slogan={organizationSlogan} canDrag={rights.update} onEdit={canEditOrganization ? onEditOrganization : undefined} />
              {rights.create && (
                <>
                  <span className="block h-3 w-px bg-border" />
                  <AddChildButton label={t("departments.addChild").replace("{name}", organizationName)} onPress={() => onAddChild(null)} />
                </>
              )}
              {trees.length > 0 ? (
                <>
                  <span className="block h-3 w-px bg-border" />
                  <ChartChildren trees={trees} context={context} />
                </>
              ) : (
                // A new company: only its card and the "+" under it, with a hint to start there.
                <p className="mt-3 text-sm text-muted">{t("departments.empty")}</p>
              )}
            </div>
          </div>

          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <Button size="sm" variant="secondary" isDisabled={myFirst === undefined} onPress={findMe}>
              {t("departments.findMe")}
            </Button>
            <NumberStepper
              aria-label={t("departments.zoom")}
              size="sm"
              value={zoom}
              onChange={(next) => Number.isFinite(next) && setZoom(next)}
              minValue={ZOOM_MIN}
              maxValue={ZOOM_MAX}
              step={ZOOM_STEP}
              formatOptions={{ style: "unit", unit: "percent" }}
              decrementLabel={t("departments.zoomOut")}
              incrementLabel={t("departments.zoomIn")}
              className="rounded-full shadow-sm"
            />
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dnd.draggedNode && (
            // A look-alike for the eye only: nothing in it can be focused or read out (the real card is announced).
            <div data-drag-overlay aria-hidden inert className="h-full w-full cursor-grabbing" style={{ transform: "rotate(3deg)" }}>
              <div className="rounded-2xl shadow-2xl" style={{ width: "15rem", transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
                <DepartmentCard
                  node={dnd.draggedNode}
                  isSelected={false}
                  isMine={mine.has(dnd.draggedNode.id)}
                  isCollapsed={collapsed.has(dnd.draggedNode.id)}
                  rights={rights}
                  onSelect={noop}
                  onToggleCollapse={noop}
                  onMenuAction={noop}
                />
              </div>
            </div>
          )}
        </DragOverlay>
      </DragStateProvider>
    </DndContext>
  );
}
