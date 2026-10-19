"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import type { DepartmentChartDto, DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { AddChildButton, ChartChildren, type ChartContext } from "./ChartBranch";
import type { DepartmentAction } from "./DepartmentCard";
import { OrganizationCard } from "./OrganizationCard";
import { ancestorIds, buildChartTree } from "./tree";

export type { DepartmentAction } from "./DepartmentCard";

const ZOOM_MIN = 50;
const ZOOM_MAX = 150;
const ZOOM_STEP = 10;

type DepartmentChartProps = {
  chart: DepartmentChartDto;
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** The "+" under a card; `null` is the "+" under the organization card (a top-level department). */
  onAddChild: (parent: DepartmentChartNode | null) => void;
  onMenuAction: (action: DepartmentAction, node: DepartmentChartNode) => void;
  /**
   * Asks the chart to bring a card into view: open its collapsed ancestors and scroll it to the middle. A new
   * `request` number asks again (also for the same id). The card may not exist yet (a department just created is
   * drawn after the chart refetches): the chart waits for it. Selecting it is the parent's business.
   */
  focusRequest?: { id: number; request: number } | null;
};

/**
 * The org chart canvas: the organization card on top and the departments below it as a tree of cards, on a pannable
 * (scrolling) light canvas. Which cards are collapsed and the zoom level are the canvas's own state; the selection
 * belongs to the parent (the drawer and dialogs of later tasks read it). "Find me" opens every collapsed ancestor of
 * the viewer's first department, selects it and scrolls it to the middle. Zoom uses CSS `zoom` rather than a
 * transform, so the scroll area follows the zoomed size.
 */
export function DepartmentChart({ chart, selectedId, onSelect, onAddChild, onMenuAction, focusRequest }: DepartmentChartProps) {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  const [collapsed, setCollapsed] = useState<ReadonlySet<number>>(() => new Set());
  const [zoom, setZoom] = useState(100);
  // A counter, so asking for the same card twice scrolls twice; the effect below runs after the cards were expanded.
  const [scrollTo, setScrollTo] = useState<{ id: number; request: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  // The last focus request that was carried out (state adjusted while rendering, the way React documents it).
  const [handledFocus, setHandledFocus] = useState(0);

  const trees = useMemo(() => buildChartTree(chart.departments), [chart.departments]);
  const mine = useMemo(() => new Set(chart.myDepartmentIds), [chart.myDepartmentIds]);
  const myFirst = chart.myDepartmentIds.find((id) => chart.departments.some((d) => d.id === id));
  const rights = {
    create: hasPermission(Permissions.Departments.Create),
    update: hasPermission(Permissions.Departments.Update),
    delete: hasPermission(Permissions.Departments.Delete),
  };

  // A focus request waits for its card to be in the chart, then opens the way to it and scrolls to it as "find me" does.
  if (focusRequest && focusRequest.request !== handledFocus && chart.departments.some((d) => d.id === focusRequest.id)) {
    setHandledFocus(focusRequest.request);
    reveal(focusRequest.id);
  }

  useEffect(() => {
    if (!scrollTo) return;
    canvas.current
      ?.querySelector(`[data-department-id="${scrollTo.id}"]`)
      ?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [scrollTo]);

  function toggle(id: number) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  /** Opens every collapsed ancestor of the card and scrolls it to the middle (the scroll runs after it was drawn). */
  function reveal(id: number) {
    const parents = new Set(ancestorIds(chart.departments, id));
    setCollapsed((current) => new Set([...current].filter((other) => !parents.has(other))));
    setScrollTo((current) => ({ id, request: (current?.request ?? 0) + 1 }));
  }

  function findMe() {
    if (myFirst === undefined) return;
    onSelect(myFirst);
    reveal(myFirst);
  }

  const context: ChartContext = {
    selectedId,
    mine,
    collapsed,
    rights,
    onSelect,
    onToggleCollapse: toggle,
    onAddChild,
    onMenuAction,
  };

  return (
    <div className="relative rounded-2xl border border-border bg-surface-secondary">
      {/* A focusable region, so its name is announced and the keyboard can scroll (pan) the canvas. */}
      <div ref={canvas} role="region" tabIndex={0} aria-label={t("departments.chart")} className="h-[70vh] min-h-96 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <div className="flex w-max min-w-full flex-col items-center p-8 pb-20" style={{ zoom: zoom / 100 }}>
          <OrganizationCard name={chart.organizationName} />
          {rights.create && (
            <>
              <span className="block h-3 w-px bg-border" />
              <AddChildButton label={t("departments.addChild").replace("{name}", chart.organizationName)} onPress={() => onAddChild(null)} />
            </>
          )}
          {trees.length > 0 && (
            <>
              <span className="block h-3 w-px bg-border" />
              <ChartChildren trees={trees} context={context} />
            </>
          )}
        </div>
      </div>

      <div className="absolute bottom-3 left-3 flex items-center gap-2">
        <Button size="sm" variant="secondary" isDisabled={myFirst === undefined} onPress={findMe}>
          {t("departments.findMe")}
        </Button>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-0.5 shadow-sm">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("departments.zoomOut")}
            isDisabled={zoom <= ZOOM_MIN}
            onPress={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
          >
            <Minus className="size-4" />
          </Button>
          <span className="min-w-12 text-center text-xs tabular-nums">{`${zoom} %`}</span>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("departments.zoomIn")}
            isDisabled={zoom >= ZOOM_MAX}
            onPress={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
