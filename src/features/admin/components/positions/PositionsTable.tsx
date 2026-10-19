"use client";

import type { ReactNode } from "react";
import { Chip, Table } from "@heroui/react";
import type { PositionDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";

type Props = {
  /** In the order to show. */
  positions: PositionDto[];
  /** The row's menu ({@link PositionActions}); the actions column exists only when this is given. */
  actions?: (position: PositionDto) => ReactNode;
  /** Shown in the table when there is no row. */
  empty: ReactNode;
};

type ColumnId = "name" | "code" | "level" | "status" | "actions";
type ColumnDef = {
  id: ColumnId;
  label: string;
  /** The least the column takes, in px: their sum is how wide the table is before it scrolls sideways. */
  width: number;
  cell: (position: PositionDto, actions: Props["actions"], t: (key: string) => string) => ReactNode;
};

const COLUMNS: ColumnDef[] = [
  { id: "name", label: "positions.columnName", width: 240, cell: (p) => <span className="block truncate font-medium text-foreground">{p.name}</span> },
  { id: "code", label: "positions.columnCode", width: 120, cell: (p) => <span className="block truncate text-muted">{p.code}</span> },
  { id: "level", label: "positions.columnLevel", width: 100, cell: (p) => <span className="tabular-nums">{p.level}</span> },
  {
    id: "status", label: "admin.status", width: 150,
    cell: (p, _actions, t) => (
      <Chip size="sm" variant="soft" color={p.isActive ? "success" : "default"}>
        {t(p.isActive ? "positions.statusActive" : "positions.statusInactive")}
      </Chip>
    ),
  },
  { id: "actions", label: "admin.columnActions", width: 72, cell: (p, actions) => actions?.(p) },
];

/** The positions as a table (name, code, level, status), in the order given; the row's menu comes from `actions`. */
export function PositionsTable({ positions, actions, empty }: Props) {
  const { t } = useLocale();
  const columns = COLUMNS.filter((column) => column.id !== "actions" || actions);

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={t("admin.positions")}
          // Fixed: the columns keep the widths given, a long name is cut short instead of widening its column.
          className="table-fixed"
          style={{ minWidth: columns.reduce((sum, column) => sum + column.width, 0) }}
        >
          <Table.Header>
            {columns.map((column) => (
              <Table.Column key={column.id} id={column.id} isRowHeader={column.id === "name"} style={{ width: column.width }}>
                {column.id === "actions" ? <span className="sr-only">{t(column.label)}</span> : t(column.label)}
              </Table.Column>
            ))}
          </Table.Header>
          <Table.Body renderEmptyState={() => empty}>
            {positions.map((position) => (
              <Table.Row key={position.id} id={position.id}>
                {columns.map((column) => (
                  <Table.Cell key={column.id}>{column.cell(position, actions, t)}</Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
