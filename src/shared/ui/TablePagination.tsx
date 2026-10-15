"use client";

import { ChevronLeft, ChevronRight } from "@gravity-ui/icons";
import { Button, Pagination } from "@heroui/react";
import { usePhone } from "@/shared/hooks/usePhone";
import { useLocale } from "@/shared/i18n";

export type PageInfo = { pageNumber: number; totalPages: number; totalCount: number; hasPreviousPage: boolean; hasNextPage: boolean };

type Props = { page: PageInfo; summary: string; onPageChange: (pageNumber: number) => void };

/** A table's pages: numbered with gaps on wide screens, a page of pages between two arrows on a phone. */
export function TablePagination(props: Props) {
  return usePhone() ? <CompactPagination {...props} /> : <FullPagination {...props} />;
}

/** A phone's pages: which rows, the page of pages, and previous/next as icons. */
function CompactPagination({ page, summary, onPageChange }: Props) {
  const { t } = useLocale();
  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-2 text-xs text-muted">
      <span className="min-w-0 truncate">{summary}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button size="sm" variant="ghost" isIconOnly className="tap-target" aria-label={t("common.previous")} isDisabled={!page.hasPreviousPage} onPress={() => onPageChange(page.pageNumber - 1)}>
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="tabular-nums">{page.pageNumber}/{page.totalPages}</span>
        <Button size="sm" variant="ghost" isIconOnly className="tap-target" aria-label={t("common.next")} isDisabled={!page.hasNextPage} onPress={() => onPageChange(page.pageNumber + 1)}>
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function FullPagination({ page, summary, onPageChange }: Props) {
  const { t } = useLocale();

  return (
    <Pagination size="sm" className="w-full">
      <Pagination.Summary>{summary}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous isDisabled={!page.hasPreviousPage} onPress={() => onPageChange(page.pageNumber - 1)}>
            <Pagination.PreviousIcon />
            <span>{t("common.previous")}</span>
          </Pagination.Previous>
        </Pagination.Item>
        {pageNumbers(page.pageNumber, page.totalPages).map((p, i) =>
          p === "ellipsis" ? (
            <Pagination.Item key={`ellipsis-${i}`}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={p}>
              <Pagination.Link isActive={p === page.pageNumber} onPress={() => onPageChange(p)}>
                {p}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next isDisabled={!page.hasNextPage} onPress={() => onPageChange(page.pageNumber + 1)}>
            <span>{t("common.next")}</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}

/** First, last, and the pages around the current one, with gaps in between. */
function pageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}
