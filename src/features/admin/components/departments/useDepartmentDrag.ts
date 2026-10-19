"use client";

import { createContext, useCallback, useContext, useState, type RefObject } from "react";
import {
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { toast } from "@heroui/react";
import { useMoveDepartmentMutation, type DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { canDrop } from "./tree";
import "../../api";

/** The droppable id of the organization card (a drop on it makes the department top-level). */
export const ORGANIZATION_DROP_ID = "organization";

/** How long the toast with "Hoàn tác" stays, a little longer than a plain toast so the undo can be reached. */
const UNDO_TOAST_TIMEOUT = 8000;

/** What a card looks like while another is dragged: `allowed` and `over` can take it, `blocked` cannot, `dragged` is the one lifted. */
export type DropState = "dragged" | "allowed" | "over" | "blocked";

type DragState = {
  draggedId: number;
  /** Every card (and the organization) the dragged one may be dropped on, worked out once when the drag starts. */
  targets: ReadonlySet<UniqueIdentifier>;
};

const DragStateContext = createContext<DragState | null>(null);
export const DragStateProvider = DragStateContext.Provider;

/**
 * The keyboard sensor's coordinate getter. dnd-kit's default moves the dragged card 25 px per arrow key, which on an
 * org chart (cards 240 px wide, far apart) takes dozens of presses and may never land on the intended card. This one
 * jumps to the nearest other card in the arrow's direction (straight along the arrow first, sideways drift costs
 * double), so Space, arrows and Space move a department wherever it may go.
 */
export const jumpToNearestCard: KeyboardCoordinateGetter = (event, { context: { active, collisionRect, droppableRects, droppableContainers }, currentCoordinates }) => {
  const direction = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[event.code];
  if (!direction || !active || !collisionRect) return undefined;
  event.preventDefault();

  const fromX = collisionRect.left + collisionRect.width / 2;
  const fromY = collisionRect.top + collisionRect.height / 2;
  let best: { dx: number; dy: number; score: number } | null = null;
  for (const container of droppableContainers.getEnabled()) {
    if (container.id === active.id) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const dx = rect.left + rect.width / 2 - fromX;
    const dy = rect.top + rect.height / 2 - fromY;
    const along = dx * direction[0] + dy * direction[1];
    if (along <= 1) continue;
    const score = along + 2 * Math.abs(dx * direction[1] + dy * direction[0]);
    if (!best || score < best.score) best = { dx, dy, score };
  }
  return best ? { x: currentCoordinates.x + best.dx, y: currentCoordinates.y + best.dy } : undefined;
};

/**
 * Where a drop lands. The pointer decides for a mouse or finger; a keyboard drag has no pointer, so the card nearest the
 * dragged one's centre wins. dnd-kit measures every card whole, ignoring that the canvas scrolls and clips them, so a
 * card scrolled out of sight (or under the details panel) would still be hit by a pointer released outside the canvas:
 * a pointer outside the canvas's visible area hits nothing, which also makes "drop it outside" a way to cancel.
 */
function detectCollisions(canvas: RefObject<HTMLElement | null>): CollisionDetection {
  return (args) => {
    const { pointerCoordinates: pointer } = args;
    if (!pointer) return closestCenter(args);
    const area = canvas.current?.getBoundingClientRect();
    if (area && (pointer.x < area.left || pointer.x > area.right || pointer.y < area.top || pointer.y > area.bottom)) return [];
    return pointerWithin(args);
  };
}

type Options = {
  nodes: DepartmentChartNode[];
  organizationName: string;
  /** The scrolling canvas the cards are drawn on: a drop outside it hits no card. */
  canvas: RefObject<HTMLElement | null>;
};

/**
 * Drag-and-drop for the chart: the sensors (pointer, 6 px before a drag starts so a click still selects; keyboard),
 * the handlers for the surrounding `DndContext`, and the move itself. When a drag starts the set of cards it may be
 * dropped on is computed once ({@link canDrop} for each card and for the organization) and shared through context,
 * so the ~200 cards read a set lookup per render rather than each walking the tree on every pointer move. A drop on
 * an unlawful target sends nothing. A move is followed by a toast with "Hoàn tác" that moves the department back to
 * where it was; a server refusal is a danger toast with the server's reason.
 */
export function useDepartmentDrag({ nodes, organizationName, canvas }: Options) {
  const { t } = useLocale();
  const [moveDepartment] = useMoveDepartmentMutation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // "auto": a jump to a far card scrolls the canvas to it at once, instead of gliding for a third of a second.
    useSensor(KeyboardSensor, { coordinateGetter: jumpToNearestCard, scrollBehavior: "auto" }),
  );
  const [drag, setDrag] = useState<DragState | null>(null);

  const nameOf = useCallback(
    (id: UniqueIdentifier | undefined) => (id === ORGANIZATION_DROP_ID ? organizationName : (nodes.find((n) => n.id === id)?.name ?? "")),
    [nodes, organizationName],
  );

  function onDragStart({ active }: DragStartEvent) {
    const draggedId = Number(active.id);
    const targets = new Set<UniqueIdentifier>();
    if (canDrop(nodes, draggedId, null)) targets.add(ORGANIZATION_DROP_ID);
    for (const node of nodes) if (canDrop(nodes, draggedId, node.id)) targets.add(node.id);
    setDrag({ draggedId, targets });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const current = drag;
    setDrag(null);
    if (!current || !over || !current.targets.has(over.id)) return;
    const node = nodes.find((n) => n.id === Number(active.id));
    if (!node) return;
    void move(node, over.id === ORGANIZATION_DROP_ID ? null : Number(over.id), nameOf(over.id));
  }

  /** Moves `node` under `parentId` (null: top level) and offers to undo it. */
  async function move(node: DepartmentChartNode, parentId: number | null, targetName: string) {
    const previousParentId = node.parentId ?? null;
    try {
      await moveDepartment({ id: node.id, moveDepartmentCommand: { parentId } }).unwrap();
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
      return;
    }
    const toastId = toast.success(t("departments.toast.moved").replace("{name}", node.name).replace("{target}", targetName), {
      timeout: UNDO_TOAST_TIMEOUT,
      actionProps: {
        children: t("departments.undo"),
        variant: "tertiary",
        onPress: () => {
          toast.close(toastId);
          void undo(node.id, previousParentId);
        },
      },
    });
  }

  async function undo(id: number, parentId: number | null) {
    try {
      await moveDepartment({ id, moveDepartmentCommand: { parentId } }).unwrap();
      toast.success(t("departments.toast.undone"));
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => t("departments.drag.pickedUp").replace("{name}", nameOf(active.id)),
    onDragOver: ({ active, over }) =>
      over
        ? t(drag?.targets.has(over.id) ? "departments.drag.over" : "departments.drag.overBlocked")
            .replace("{name}", nameOf(active.id))
            .replace("{target}", nameOf(over.id))
        : undefined,
    onDragEnd: ({ active }) => t("departments.drag.dropped").replace("{name}", nameOf(active.id)),
    onDragCancel: ({ active }) => t("departments.drag.cancelled").replace("{name}", nameOf(active.id)),
  };

  return {
    sensors,
    collisionDetection: detectCollisions(canvas),
    announcements,
    instructions: t("departments.drag.instructions"),
    drag,
    draggedNode: drag ? (nodes.find((n) => n.id === drag.draggedId) ?? null) : null,
    onDragStart,
    onDragEnd,
    onDragCancel: () => setDrag(null),
  };
}

/** How a droppable with this id looks right now, from the drag in progress (undefined when nothing is dragged). */
function dropStateOf(drag: DragState | null, id: UniqueIdentifier, isOver: boolean): DropState | undefined {
  if (!drag) return undefined;
  if (id === drag.draggedId) return "dragged";
  if (!drag.targets.has(id)) return "blocked";
  return isOver ? "over" : "allowed";
}

/**
 * A department card as both a drag source and a drop target: the ref for the card element, the props for its grip
 * button (omitted without `canDrag`, which also stops the card taking part at all) and the state to style it by.
 */
export function useCardDrag(id: number, canDrag: boolean) {
  const drag = useContext(DragStateContext);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id, disabled: !canDrag });
  const { setNodeRef: setDragRef, setActivatorNodeRef, attributes, listeners } = useDraggable({ id, disabled: !canDrag });
  const rootRef = useCallback(
    (element: HTMLElement | null) => {
      setDropRef(element);
      setDragRef(element);
    },
    [setDropRef, setDragRef],
  );
  return {
    rootRef,
    handleProps: canDrag ? { ref: setActivatorNodeRef, ...attributes, ...listeners } : null,
    dropState: canDrag ? dropStateOf(drag, id, isOver) : undefined,
  };
}

/** The organization card as a drop target (a drop on it makes the department top-level). */
export function useOrganizationDrop(canDrag: boolean) {
  const drag = useContext(DragStateContext);
  const { setNodeRef, isOver } = useDroppable({ id: ORGANIZATION_DROP_ID, disabled: !canDrag });
  return { rootRef: setNodeRef, dropState: canDrag ? dropStateOf(drag, ORGANIZATION_DROP_ID, isOver) : undefined };
}

/** The classes a card gets from its drop state: a not-allowed outline where the drop would do nothing (the lifted card is a placeholder, see DepartmentCard). */
export function dropStateClass(state: DropState | undefined): string {
  switch (state) {
    case "dragged":
      return "";
    case "allowed":
      return "outline outline-2 outline-offset-2 outline-accent/40";
    case "over":
      return "outline outline-2 outline-offset-2 outline-accent bg-accent-soft";
    case "blocked":
      return "cursor-not-allowed outline outline-2 outline-dashed outline-offset-2 outline-danger/60";
    default:
      return "";
  }
}
