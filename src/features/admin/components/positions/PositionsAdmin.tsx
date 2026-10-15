"use client";

import { useRef, useState } from "react";
import { Pencil, Plus, TrashBin } from "@gravity-ui/icons";
import { Alert, Button, Chip, SearchField, Skeleton, Table, toast } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import {
  useDeletePositionMutation,
  useGetPositionsQuery,
  useUpdatePositionMutation,
  type PositionDto,
} from "@/shared/api/generated/portalApi";
import { Permissions } from "@/shared/auth/permissions";
import { useLocale } from "@/shared/i18n";
import { matchesVietnamese } from "@/shared/lib/vietnameseSearch";
import { AdminGate } from "../AdminGate";
import { DeleteOrRetireDialog } from "../DeleteOrRetireDialog";
import { PositionDialog } from "./PositionDialog";

/** Positions: the job titles and their rank (level 1 is the highest), for whoever may view them. */
export function PositionsAdmin() {
  return (
    <AdminGate permission={Permissions.Positions.View}>
      <PositionsPage />
    </AdminGate>
  );
}

type Opened = { key: number; kind: "edit"; position?: PositionDto } | { key: number; kind: "delete"; position: PositionDto };

/** Highest rank first, then by title. */
const byRank = (a: PositionDto, b: PositionDto) => a.level - b.level || a.name.localeCompare(b.name);

function PositionsPage() {
  const { t } = useLocale();
  const { hasPermission } = useCurrentUser();
  const positions = useGetPositionsQuery({});
  const [updatePosition] = useUpdatePositionMutation();
  const [deletePosition] = useDeletePositionMutation();
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState<Opened | null>(null);
  // A new key remounts a dialog (a fresh form) each time it is opened.
  const counter = useRef(0);
  const open = (next: Omit<Opened, "key">) => { counter.current += 1; setOpened({ ...next, key: counter.current } as Opened); };

  const canCreate = hasPermission(Permissions.Positions.Create);
  const canUpdate = hasPermission(Permissions.Positions.Update);
  const canDelete = hasPermission(Permissions.Positions.Delete);
  const rows = [...(positions.data ?? [])]
    .filter((position) => matchesVietnamese(position.name, search) || matchesVietnamese(position.code, search))
    .sort(byRank);

  const retire = (position: PositionDto) => updatePosition({
    id: position.id,
    updatePositionCommand: {
      code: position.code, name: position.originalName, originalName: position.originalName,
      level: position.level, description: position.description ?? null, isActive: false,
    },
  }).unwrap().then(() => toast.success(t("admin.positionRetired")));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("admin.positions")}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField aria-label={t("admin.searchPositions")} value={search} onChange={setSearch} className="phone:w-full phone:min-w-0">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input className="w-56 phone:w-full" placeholder={t("admin.searchPositions")} />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          {canCreate && (
            <Button onPress={() => open({ kind: "edit" })}>
              <Plus className="size-4" />
              {t("admin.createPosition")}
            </Button>
          )}
        </div>
      </div>

      {positions.isError && (
        <Alert status="danger" role="alert">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t("admin.positionsLoadError")}</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="secondary" onPress={() => positions.refetch()}>{t("admin.retry")}</Button>
        </Alert>
      )}

      {positions.isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label={t("admin.positions")} className="min-w-[720px]">
              <Table.Header>
                <Table.Column isRowHeader id="name">{t("admin.positionName")}</Table.Column>
                <Table.Column id="code">{t("admin.code")}</Table.Column>
                <Table.Column id="level">{t("admin.level")}</Table.Column>
                <Table.Column id="description">{t("admin.description")}</Table.Column>
                <Table.Column id="holders">{t("admin.holders")}</Table.Column>
                <Table.Column id="status">{t("admin.status")}</Table.Column>
                {(canUpdate || canDelete) && <Table.Column id="actions"><span className="sr-only">{t("admin.columnActions")}</span></Table.Column>}
              </Table.Header>
              <Table.Body renderEmptyState={() => <p className="py-10 text-center text-sm text-muted">{t("admin.noPositions")}</p>}>
                {rows.map((position) => (
                  <Table.Row key={position.id} id={position.id}>
                    <Table.Cell><span className="font-medium text-foreground">{position.name}</span></Table.Cell>
                    <Table.Cell><span className="font-mono text-xs">{position.code}</span></Table.Cell>
                    <Table.Cell><span className="tabular-nums">{position.level}</span></Table.Cell>
                    <Table.Cell><span className="line-clamp-2 text-muted">{position.description}</span></Table.Cell>
                    <Table.Cell><span className="tabular-nums">{position.holderCount}</span></Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" variant="soft" color={position.isActive ? "success" : "default"}>
                        {t(position.isActive ? "admin.inUse" : "admin.notInUse")}
                      </Chip>
                    </Table.Cell>
                    {(canUpdate || canDelete) && (
                      <Table.Cell>
                        <div className="flex justify-end gap-1">
                          {canUpdate && (
                            <Button size="sm" variant="ghost" isIconOnly aria-label={t("admin.edit")} onPress={() => open({ kind: "edit", position })}>
                              <Pencil className="size-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="ghost" isIconOnly aria-label={t("admin.delete")} onPress={() => open({ kind: "delete", position })}>
                              <TrashBin className="size-4" />
                            </Button>
                          )}
                        </div>
                      </Table.Cell>
                    )}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {opened?.kind === "edit" && <PositionDialog key={opened.key} position={opened.position} onClose={() => setOpened(null)} />}
      {opened?.kind === "delete" && (
        <DeleteOrRetireDialog
          key={opened.key}
          title={t("admin.deletePositionTitle").replace("{name}", opened.position.name)}
          canDelete={opened.position.canDelete}
          confirmText={t("admin.deletePositionConfirm")}
          blockedText={t(opened.position.holderCount > 0 ? "admin.positionHeld" : "admin.positionHeldBefore")}
          retireLabel={t("admin.retirePosition")}
          onDelete={() => deletePosition({ id: opened.position.id }).unwrap().then(() => toast.success(t("admin.positionDeleted")))}
          onRetire={canUpdate && opened.position.isActive ? () => retire(opened.position) : undefined}
          onClose={() => setOpened(null)}
        />
      )}
    </div>
  );
}
