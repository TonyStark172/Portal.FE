"use client";

import { Pencil } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n";
import { DepartmentActionMenu } from "./DepartmentActionMenu";
import { dropStateClass, useOrganizationDrop } from "./useDepartmentDrag";

/**
 * The card at the top of the chart: the organization itself (a building icon, its name and, when it has one, its slogan as a muted line). While a department is
 * dragged it is a drop target too (dropping on it makes the department top-level), when `canDrag` is set. With
 * `onEdit` it also has a "⋯" menu whose one item, "Sửa thông tin công ty", calls it (give it only to someone who may
 * edit the company).
 */
export function OrganizationCard({ name, slogan, canDrag = false, onEdit }: { name: string; slogan?: string | null; canDrag?: boolean; onEdit?: () => void }) {
  const { t } = useLocale();
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
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 break-words text-sm font-semibold">{name}</span>
        {slogan && <span className="line-clamp-2 break-words text-xs text-muted">{slogan}</span>}
      </div>
      {onEdit && (
        <DepartmentActionMenu
          items={[{ id: "edit", label: t("departments.company.edit"), icon: <Pencil className="size-4 shrink-0 text-muted" /> }]}
          label={t("departments.menu").replace("{name}", name)}
          onAction={onEdit}
        />
      )}
    </div>
  );
}
