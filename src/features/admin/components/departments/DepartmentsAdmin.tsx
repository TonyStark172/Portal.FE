"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { Plus } from "@gravity-ui/icons";
import { Alert, Button, Card, Modal, SearchField, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  portalApi,
  useGetDepartmentTreeQuery,
  useGetDepartmentsQuery,
  type DepartmentDto,
} from "@/shared/api/generated/portalApi";
import "../../api";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { TablePagination } from "@/shared/ui/TablePagination";
import { flatten } from "../../lib/departmentTree";
import { AdminGate } from "../AdminGate";
import { DeleteDepartmentDialog } from "./DeleteDepartmentDialog";
import { DepartmentCard } from "./DepartmentCard";
import { DepartmentDetails } from "./DepartmentDetails";
import { DepartmentDialog } from "./DepartmentDialog";
import { DepartmentMembers } from "./DepartmentMembers";

/** Cards per page: each card reads its first faces, so a page stays small. */
export const CARDS_PAGE_SIZE = 12;

/**
 * Departments as a grid of cards, in the order of the tree, with a search. A card opens the department's details and
 * members; its menu adds a sub-department or deletes it. For whoever may view departments; the rest by permission.
 */
export function DepartmentsAdmin() {
  return (
    <AdminGate permission={Permissions.Departments.View}>
      <DepartmentsPage />
    </AdminGate>
  );
}

function DepartmentsPage() {
  const { t, locale } = useLocale();
  const { hasPermission } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const tree = useGetDepartmentTreeQuery();
  const list = useGetDepartmentsQuery({ search: debounced || undefined });
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState<{ key: number; parentId: number | null } | null>(null);
  const [deleting, setDeleting] = useState<DepartmentDto | null>(null);
  const opened = useRef(0);
  const dispatch = useDispatch();
  // Bumped when a department is deleted: once nothing shows it any more, everything about departments is read again.
  const [deletions, setDeletions] = useState(0);
  useEffect(() => {
    if (deletions > 0) dispatch(portalApi.util.invalidateTags(["Departments"]));
  }, [deletions, dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPageNumber(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const canCreate = hasPermission(Permissions.Departments.Create);
  const canUpdate = hasPermission(Permissions.Departments.Update);
  const canDelete = hasPermission(Permissions.Departments.Delete);
  const nodes = useMemo(() => tree.data ?? [], [tree.data]);

  // The order of the tree: a department, then the ones under it; any the tree does not hold yet go last.
  const cards = useMemo(() => {
    const order = new Map(flatten(nodes).map(({ node }, index) => [node.id, index]));
    return [...(list.data ?? [])].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
  }, [list.data, nodes]);
  const totalPages = Math.max(1, Math.ceil(cards.length / CARDS_PAGE_SIZE));
  const current = Math.min(pageNumber, totalPages);
  const shown = cards.slice((current - 1) * CARDS_PAGE_SIZE, current * CARDS_PAGE_SIZE);

  const add = (parentId: number | null) => { opened.current += 1; setAdding({ key: opened.current, parentId }); };
  const deleted = () => { setOpenId(null); setDeletions((count) => count + 1); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("admin.departments")}</h2>
        <div className="flex flex-wrap items-center gap-2 phone:w-full">
          <SearchField aria-label={t("admin.searchDepartments")} value={search} onChange={setSearch} className="phone:min-w-0 phone:flex-1">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input className="w-56 phone:w-full" placeholder={t("admin.searchDepartments")} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {canCreate && (
            <Button onPress={() => add(null)}>
              <Plus className="size-4" />
              {t("admin.createDepartment")}
            </Button>
          )}
        </div>
      </div>

      {list.isError || tree.isError ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content><Alert.Description>{t("admin.departmentsLoadError")}</Alert.Description></Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => { void list.refetch(); void tree.refetch(); }}>{t("admin.retry")}</Button>
        </Alert>
      ) : !list.data || !tree.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-44 rounded-3xl" />)}
        </div>
      ) : cards.length === 0 ? (
        <Card className="items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted">{t(debounced ? "admin.noDepartmentsFound" : "admin.noDepartments")}</p>
          {canCreate && !debounced && (
            <Button variant="secondary" onPress={() => add(null)}>
              <Plus className="size-4" />
              {t("admin.createDepartment")}
            </Button>
          )}
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((department) => (
              <DepartmentCard key={department.id} department={department}
                onOpen={() => setOpenId(department.id)}
                onAddChild={canCreate ? () => add(department.id) : undefined}
                onDelete={canDelete ? () => setDeleting(department) : undefined} />
            ))}
          </div>
          {totalPages > 1 && (
            <TablePagination
              page={{ pageNumber: current, totalPages, totalCount: cards.length, hasPreviousPage: current > 1, hasNextPage: current < totalPages }}
              summary={t("admin.departmentsRange")
                .replace("{first}", ((current - 1) * CARDS_PAGE_SIZE + 1).toLocaleString(locale))
                .replace("{last}", Math.min(current * CARDS_PAGE_SIZE, cards.length).toLocaleString(locale))
                .replace("{total}", cards.length.toLocaleString(locale))}
              onPageChange={setPageNumber}
            />
          )}
        </>
      )}

      {openId !== null && (
        <Modal.Backdrop isOpen onOpenChange={(open) => !open && setOpenId(null)}>
          <Modal.Container size="lg" placement="center" scroll="inside">
            <Modal.Dialog aria-label={cards.find((one) => one.id === openId)?.name ?? t("admin.departmentDetails")}>
              <Modal.CloseTrigger aria-label={t("admin.close")} />
              <Modal.Body className="flex flex-col gap-6 p-1">
                <DepartmentDetails departmentId={openId} tree={nodes} canUpdate={canUpdate} canDelete={canDelete} onDeleted={deleted} />
                <DepartmentMembers key={openId} departmentId={openId} />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}

      {adding && <DepartmentDialog key={adding.key} tree={nodes} parentId={adding.parentId} onClose={() => setAdding(null)} />}

      {deleting && (
        <DeleteDepartmentDialog department={deleting} canUpdate={canUpdate} onDeleted={deleted} onClose={() => setDeleting(null)} />
      )}
    </div>
  );
}

