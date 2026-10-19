import type { DepartmentChartNode } from "@/shared/api/generated/portalApi";

/** A department card and the cards drawn under it. */
export type ChartTree = { node: DepartmentChartNode; children: ChartTree[] };

/** The server sends a top-level department with a null parentId; a missing key means the same thing. */
function parentOf(node: DepartmentChartNode): number | null {
  return node.parentId ?? null;
}

/** Child ids per parent id, in the input order (the server already sorts by name). */
function childIdsByParent(nodes: DepartmentChartNode[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const n of nodes) {
    const parent = parentOf(n);
    if (parent === null) continue;
    const list = map.get(parent);
    if (list) list.push(n.id);
    else map.set(parent, [n.id]);
  }
  return map;
}

/**
 * Nests the flat list into trees. A top-level card has no parent, or a parent that is not in the list (an orphan
 * must still be reachable, so it is drawn at the top rather than dropped). Siblings keep the input order.
 */
export function buildChartTree(nodes: DepartmentChartNode[]): ChartTree[] {
  const byId = new Map<number, ChartTree>();
  for (const node of nodes) byId.set(node.id, { node, children: [] });

  const roots: ChartTree[] = [];
  for (const node of nodes) {
    const entry = byId.get(node.id)!;
    const parent = parentOf(node);
    const parentEntry = parent === null ? undefined : byId.get(parent);
    if (parentEntry && parentEntry !== entry) parentEntry.children.push(entry);
    else roots.push(entry);
  }
  return roots;
}

/** Every card below `id` at any depth (not `id` itself). The visited set also guards against a cyclic input. */
export function descendantIds(nodes: DepartmentChartNode[], id: number): Set<number> {
  const children = childIdsByParent(nodes);
  const result = new Set<number>();
  const stack = [...(children.get(id) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (result.has(current) || current === id) continue;
    result.add(current);
    stack.push(...(children.get(current) ?? []));
  }
  return result;
}

/** The parents of `id`, nearest first, up to the top; used to expand collapsed ancestors when jumping to a card. */
export function ancestorIds(nodes: DepartmentChartNode[], id: number): number[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const result: number[] = [];
  const seen = new Set<number>([id]);
  let parent = byId.get(id) ? parentOf(byId.get(id)!) : null;
  while (parent !== null && byId.has(parent) && !seen.has(parent)) {
    result.push(parent);
    seen.add(parent);
    parent = parentOf(byId.get(parent)!);
  }
  return result;
}

/**
 * Whether dropping `draggedId` onto `targetId` would be a real, valid move. `null` is the organization card (move to
 * the top level). False for: an unknown card, the card itself, one of its descendants (a cycle), an inactive target,
 * and the card's current parent (a no-op; a top-level card dropped on the organization is also a no-op).
 */
export function canDrop(nodes: DepartmentChartNode[], draggedId: number, targetId: number | null): boolean {
  const dragged = nodes.find((n) => n.id === draggedId);
  if (!dragged) return false;
  if (targetId === parentOf(dragged)) return false;
  if (targetId === null) return true;
  if (targetId === draggedId) return false;
  const target = nodes.find((n) => n.id === targetId);
  if (!target || !target.isActive) return false;
  return !descendantIds(nodes, draggedId).has(targetId);
}

/** Longest code the create dialog suggests. */
const MAX_SUGGESTED_CODE_LENGTH = 10;

/**
 * Suggests a department code from its name: the first letter or digit of each word, without Vietnamese diacritics,
 * upper-cased, at most 10 characters ("Phòng Hành chính Nhân sự" gives "PHCNS"). Punctuation separates words and is
 * otherwise ignored; an empty name gives an empty code.
 */
export function suggestDepartmentCode(name: string): string {
  const plain = name
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return plain
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase())
    .join("")
    .slice(0, MAX_SUGGESTED_CODE_LENGTH);
}
