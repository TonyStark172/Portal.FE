"use client";

import { dropStateClass, useOrganizationDrop } from "./useDepartmentDrag";

/**
 * The card at the top of the chart: the organization itself (a building icon and its name). While a department is
 * dragged it is a drop target too (dropping on it makes the department top-level), when `canDrag` is set.
 */
export function OrganizationCard({ name, canDrag = false }: { name: string; canDrag?: boolean }) {
  const { rootRef, dropState } = useOrganizationDrop(canDrag);
  return (
    <div
      ref={rootRef}
      data-drop-state={dropState}
      className={`flex w-60 items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm ${dropStateClass(dropState)}`}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
          <path d="M14 10h5a1 1 0 0 1 1 1v10" />
          <path d="M2 21h20" />
          <path d="M8 8h2M8 12h2M8 16h2" />
        </svg>
      </span>
      <span className="line-clamp-2 min-w-0 break-words text-sm font-semibold">{name}</span>
    </div>
  );
}
