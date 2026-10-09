"use client";

import type { ReactNode } from "react";
import { Button, Card, Skeleton } from "@heroui/react";

type ChartCardProps = {
  title: string;
  description?: ReactNode;
  /** Top right of the card: a legend, a filter… */
  actions?: ReactNode;
  /** A headline figure under the title. */
  summary?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
};

/**
 * The frame of every dashboard chart: header (title, description, actions), optional headline figure, then the
 * chart. Loading, error and empty states are handled here so each chart only draws its data.
 */
export function ChartCard({
  title,
  description,
  actions,
  summary,
  isLoading,
  isError,
  onRetry,
  isEmpty,
  emptyMessage = "Chưa có dữ liệu.",
  children,
}: ChartCardProps) {
  return (
    <Card className="dashboard-reveal h-full gap-4">
      <Card.Header className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Card.Title className="text-base font-semibold">{title}</Card.Title>
          {description && <Card.Description>{description}</Card.Description>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </Card.Header>

      <Card.Content className="flex flex-1 flex-col gap-4">
        {isLoading ? (
          <div role="status" aria-label={`Đang tải ${title.toLowerCase()}`} className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/3 rounded-md" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted">Không tải được dữ liệu.</p>
            {onRetry && (
              <Button size="sm" variant="secondary" onPress={onRetry}>
                Thử lại
              </Button>
            )}
          </div>
        ) : isEmpty ? (
          <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-muted">{emptyMessage}</p>
        ) : (
          <>
            {summary}
            {children}
          </>
        )}
      </Card.Content>
    </Card>
  );
}
