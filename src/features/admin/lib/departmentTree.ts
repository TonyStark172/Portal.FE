import type { DepartmentTreeNode } from "@/shared/api/generated/portalApi";

/** The node with this id, anywhere in the tree. */
export function findNode(nodes: DepartmentTreeNode[], id: number): DepartmentTreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

/** The parent id of a node: null at the top, undefined when the tree does not hold it. */
export function parentOf(nodes: DepartmentTreeNode[], id: number, parent: number | null = null): number | null | undefined {
  for (const node of nodes) {
    if (node.id === id) return parent;
    const found = parentOf(node.children ?? [], id, node.id);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The ids of a node and of everything under it: where it may not go. Empty when the tree does not hold it. */
export function subtreeIds(nodes: DepartmentTreeNode[], id: number): Set<number> {
  const ids = new Set<number>();
  const collect = (node: DepartmentTreeNode) => {
    ids.add(node.id);
    (node.children ?? []).forEach(collect);
  };
  const root = findNode(nodes, id);
  if (root) collect(root);
  return ids;
}

/** Every node, depth first, with how deep it sits (0 at the top): the order of the tree, for a flat list. */
export function flatten(nodes: DepartmentTreeNode[], depth = 0): { node: DepartmentTreeNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children ?? [], depth + 1)]);
}

/**
 * Whether `dragged` may be dropped onto `target` (null = the top level): it must move somewhere new, never under
 * itself or one of its own sub-departments (the API refuses that too).
 */
export function canDrop(nodes: DepartmentTreeNode[], dragged: number, target: number | null): boolean {
  const parent = parentOf(nodes, dragged);
  if (parent === undefined || parent === target) return false;
  return target === null || !subtreeIds(nodes, dragged).has(target);
}
