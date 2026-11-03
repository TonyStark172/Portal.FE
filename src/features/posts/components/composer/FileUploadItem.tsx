"use client";

import { CircleCheckFill, CircleXmarkFill, TrashBin } from "@gravity-ui/icons";
import { Button, ProgressBar } from "@heroui/react";
import { useLocale } from "@/shared/i18n";
import type { FileUpload } from "../../hooks/useFileUploads";
import { FileFormatIcon, formatFileSize } from "../AttachmentList";

/** A file being attached: its format, name and size, how its upload is going, and pressing to try again or to remove it. */
export function FileUploadItem({ item, isDisabled = false, onRetry, onRemove }: { item: FileUpload; isDisabled?: boolean; onRetry: () => void; onRemove: () => void }) {
  const { t } = useLocale();
  const percent = Math.round(item.progress * 100);

  return (
    <div
      data-status={item.status}
      className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 data-[status=error]:border-danger/40"
    >
      <FileFormatIcon fileName={item.name} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
        <span className="flex flex-wrap items-center gap-1 text-xs text-muted">
          {formatFileSize(item.size)}
          <span aria-hidden>|</span>
          {item.status === "uploading" && t("posts.file.uploadingPercent").replace("{percent}", String(percent))}
          {item.status === "done" && (
            <>
              <CircleCheckFill aria-hidden className="size-3 text-success" />
              {t("posts.file.uploaded")}
            </>
          )}
          {item.status === "error" && (
            <>
              <CircleXmarkFill aria-hidden className="size-3 text-danger" />
              <span className="text-danger">{t("posts.file.uploadError")}</span>
            </>
          )}
        </span>
        {item.status === "uploading" && (
          <ProgressBar aria-label={t("posts.file.uploading").replace("{name}", item.name)} value={percent} size="sm">
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        )}
        {item.status === "error" && item.source && (
          <Button size="sm" variant="danger-soft" className="mt-1 self-start" isDisabled={isDisabled} onPress={onRetry}>
            {t("posts.retry")}
          </Button>
        )}
      </div>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className="text-muted"
        aria-label={t("posts.file.remove").replace("{name}", item.name)}
        isDisabled={isDisabled}
        onPress={onRemove}
      >
        <TrashBin className="size-4" />
      </Button>
    </div>
  );
}
