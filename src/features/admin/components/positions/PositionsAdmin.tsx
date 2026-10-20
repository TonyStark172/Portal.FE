"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "@gravity-ui/icons";
import { Alert, Button, Chip, ListBox, SearchField, Select, Skeleton, Spinner } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetPositionsQuery, type PositionDto } from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { AdminNoAccess } from "../AdminNoAccess";
import { PositionActions } from "./PositionActions";
import { PositionDialog } from "./PositionDialog";
import { PositionsTable } from "./PositionsTable";

/** What the status filter can be; "all" leaves it out of the request. */
type StatusFilter = "active" | "inactive" | "all";

const isActiveOf = (status: StatusFilter) => (status === "active" ? true : status === "inactive" ? false : undefined);

/** Highest level first (1 is the highest), then by name. */
const byLevelThenName = (locale: string) => (a: PositionDto, b: PositionDto) => a.level - b.level || a.name.localeCompare(b.name, locale);

/**
 * Positions: needs Positions.View, so anyone else typing /admin/positions gets the no-access notice and the requests
 * below are not even sent for them. "Add position" (with Positions.Create) opens {@link PositionDialog}; each row has its
 * menu ({@link PositionActions}: edit, discontinue or reactivate, delete) for whoever holds a right to any of them, and
 * with only Positions.View the table has no actions column at all. A position names a post (title and level) and grants
 * no permission.
 */
export function PositionsAdmin() {
  const { hasPermission, isLoading } = useCurrentUser();
  const { t } = useLocale();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner aria-label={t("admin.opening")} />
      </div>
    );
  }
  if (!hasPermission(Permissions.Positions.View)) return <AdminNoAccess />;

  return <PositionsPage />;
}

function PositionsPage() {
  const { t, locale } = useLocale();
  const { hasPermission } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  // A new key remounts the add dialog (an empty form) each time it is opened.
  const [adding, setAdding] = useState<number | null>(null);
  const opened = useRef(0);

  const canCreate = hasPermission(Permissions.Positions.Create);
  const canAct = hasPermission(Permissions.Positions.Update) || hasPermission(Permissions.Positions.Delete);

  // Ask the back end once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, refetch } = useGetPositionsQuery({
    isActive: isActiveOf(status),
    search: debouncedSearch || undefined,
  });
  // The list is small: sorted here rather than asked of the server.
  const sorted = useMemo(() => (data ? [...data].sort(byLevelThenName(locale)) : undefined), [data, locale]);
  // A new position starts one level below the lowest one listed, so a ladder is built by pressing "Thêm chức vụ" in order.
  const nextLevel = sorted && sorted.length > 0 ? sorted[sorted.length - 1].level + 1 : 1;

  const add = () => {
    opened.current += 1;
    setAdding(opened.current);
  };
  const addButton = (
    <Button onPress={add}>
      <Plus className="size-4" />
      {t("positions.add")}
    </Button>
  );

  return (
    <section aria-labelledby="positions-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 id="positions-heading" className="text-lg font-semibold">
            {t("admin.positions")}
          </h2>
          {sorted && (
            <Chip size="sm" variant="soft" data-testid="positions-count">
              {sorted.length.toLocaleString(locale)}
            </Chip>
          )}
        </div>
        {canCreate && addButton}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchField aria-label={t("positions.search")} value={search} onChange={setSearch} className="phone:w-full phone:min-w-0">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input className="w-64 phone:w-full" placeholder={t("positions.search")} />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Select
          aria-label={t("admin.status")}
          className="w-48 phone:w-full"
          selectedKey={status}
          onSelectionChange={(key) => key !== null && setStatus(String(key) as StatusFilter)}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {[
                { id: "active", name: t("positions.statusActive") },
                { id: "inactive", name: t("positions.statusInactive") },
                { id: "all", name: t("admin.statusAll") },
              ].map((option) => (
                <ListBox.Item id={option.id} key={option.id} textValue={option.name}>
                  {option.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>

      {isLoading ? (
        <div role="status" aria-label={t("admin.opening")} className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : isError || !sorted ? (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t("positions.loadError")}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => void refetch()}>
            {t("admin.retry")}
          </Button>
        </Alert>
      ) : (
        <PositionsTable
          positions={sorted}
          actions={canAct ? (position) => <PositionActions position={position} /> : undefined}
          empty={
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-center text-sm text-muted">{t(debouncedSearch ? "positions.noMatch" : "positions.empty")}</p>
              {canCreate && !debouncedSearch && addButton}
            </div>
          }
        />
      )}

      {adding !== null && <PositionDialog key={adding} suggestedLevel={nextLevel} onClose={() => setAdding(null)} />}
    </section>
  );
}
