"use client";

import { useState } from "react";
import { Magnifier, Plus } from "@gravity-ui/icons";
import { Alert, Button, Skeleton, Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetDepartmentChartQuery, type DepartmentChartNode } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { AdminNoAccess } from "../AdminNoAccess";
import { AddMembersDialog } from "./AddMembersDialog";
import { DepartmentChart, type DepartmentAction } from "./DepartmentChart";
import { DepartmentPanel } from "./DepartmentPanel";
import { DepartmentWizard } from "./DepartmentWizard";
import "../../api";

/**
 * Departments: needs Departments.View, so anyone else typing /admin/departments gets the no-access notice (and no
 * request is sent). The page is a toolbar (title, "Thêm phòng ban", search) over the org chart, with a skeleton while
 * loading, an error with retry, and an empty state that invites adding the first department. Selecting a card opens
 * its details panel beside the chart ({@link DepartmentPanel}; closing it clears the selection), and the menu items
 * "Thêm nhân viên đa phòng ban" / "Chuyển nhân viên về phòng này" open {@link AddMembersDialog}. The create/edit wizard
 * ({@link DepartmentWizard}) opens from the toolbar button (the new department hangs from the selected department
 * when one is selected and active, else from the top level), from a card's "+" and "Thêm phòng ban con" (under that
 * card), from the "+" under the organization card (top level), and from the "Sửa phòng ban" menu items (card and
 * panel); once it saves, the card is selected and scrolled to. The dialogs the remaining menu items will open come in
 * the following tasks, so those handlers are no-ops for now, and the search button stays disabled until the parent
 * gives it `onSearch`.
 */
export function DepartmentsAdmin({ onSearch }: { onSearch?: () => void }) {
  const { hasPermission, isLoading } = useCurrentUser();
  const { t } = useLocale();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const canView = !isLoading && hasPermission(Permissions.Departments.View);
  const chart = useGetDepartmentChartQuery(undefined, { skip: !canView });
  // Which department's staff are being added, and how; the dialog exists only while this is set.
  const [adding, setAdding] = useState<{ departmentId: number; mode: "alongside" | "transfer" } | null>(null);
  // The wizard exists only while this is set: a department being edited, or a new one under `parentId` (null: top level).
  const [wizard, setWizard] = useState<{ mode: "create"; parentId: number | null } | { mode: "edit"; department: DepartmentChartNode } | null>(null);
  // Asks the chart to scroll to the card just saved; a counter, so the same card can be asked for twice.
  const [focus, setFocus] = useState<{ id: number; request: number } | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={t("admin.opening")} />
      </div>
    );
  }
  if (!canView) return <AdminNoAccess />;

  // The panel shows the chart's current copy of the selected department (so it follows renames and counts), and is
  // gone when that department no longer exists.
  const selected = chart.data?.departments.find((department) => department.id === selectedId);
  const onMenuAction = (action: DepartmentAction, node: DepartmentChartNode) => {
    if (action === "addAlongside") setAdding({ departmentId: node.id, mode: "alongside" });
    else if (action === "transferIn") setAdding({ departmentId: node.id, mode: "transfer" });
    else if (action === "edit") setWizard({ mode: "edit", department: node });
    else if (action === "addChild") setWizard({ mode: "create", parentId: node.id });
  };
  const onSaved = (id: number) => {
    setSelectedId(id);
    setFocus((current) => ({ id, request: (current?.request ?? 0) + 1 }));
  };

  const canCreate = hasPermission(Permissions.Departments.Create);
  const addButton = canCreate && (
    <Button onPress={() => setWizard({ mode: "create", parentId: selected?.isActive ? selected.id : null })}>
      <Plus className="size-4" />
      {t("departments.add")}
    </Button>
  );

  return (
    <section aria-label={t("admin.departments")} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("departments.title")}</h2>
        <div className="flex items-center gap-2">
          <Button isIconOnly variant="secondary" aria-label={t("departments.search")} isDisabled={!onSearch} onPress={onSearch}>
            <Magnifier className="size-4" />
          </Button>
          {addButton}
        </div>
      </div>

      {chart.isError && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t("departments.loadError")}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => void chart.refetch()}>
            {t("admin.retry")}
          </Button>
        </Alert>
      )}

      {chart.isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : chart.data && chart.data.departments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-secondary px-6 py-16 text-center">
          <p className="text-sm text-muted">{t("departments.empty")}</p>
          {addButton}
        </div>
      ) : (
        chart.data && (
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="min-w-0 flex-1">
              <DepartmentChart
                chart={chart.data}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddChild={(parent) => setWizard({ mode: "create", parentId: parent?.id ?? null })}
                onMenuAction={onMenuAction}
                focusRequest={focus}
              />
            </div>
            {selected && <DepartmentPanel key={selected.id} node={selected} onClose={() => setSelectedId(null)} onMenuAction={onMenuAction} />}
          </div>
        )
      )}

      {wizard && chart.data && (
        <DepartmentWizard
          // A new wizard per department (or per create), so nothing typed for one carries to the next.
          key={wizard.mode === "edit" ? `edit-${wizard.department.id}` : "create"}
          mode={wizard.mode}
          department={wizard.mode === "edit" ? wizard.department : undefined}
          parentId={wizard.mode === "create" ? wizard.parentId : undefined}
          nodes={chart.data.departments}
          organizationName={chart.data.organizationName}
          onClose={() => setWizard(null)}
          onSaved={onSaved}
        />
      )}
      {adding && <AddMembersDialog departmentId={adding.departmentId} mode={adding.mode} onClose={() => setAdding(null)} />}
    </section>
  );
}
