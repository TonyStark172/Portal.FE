"use client";

import type { ReactNode } from "react";
import { toast } from "@heroui/react";
import type { PostFileDto } from "@/shared/api/generated/portalApi";
import { useDownloadPostFile } from "../hooks/usePostFile";
import { useLocale } from "@/shared/i18n";
import { getStoredLocale } from "@/shared/i18n/locale";

const badgeByExtension: Record<string, string> = {
  pdf: "bg-red-600",
  doc: "bg-blue-600",
  docx: "bg-blue-600",
  xls: "bg-green-700",
  xlsx: "bg-green-700",
  csv: "bg-green-700",
  ppt: "bg-orange-700",
  pptx: "bg-orange-700",
  zip: "bg-amber-700",
};

/** A sheet of paper with the file's format on a badge in its colour, from its extension. */
export function FileFormatIcon({ fileName }: { fileName: string }) {
  const dot = fileName.lastIndexOf(".");
  const extension = dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";

  return (
    <span aria-hidden className="relative block h-10 w-8 shrink-0">
      <svg viewBox="0 0 32 40" fill="none" className="absolute inset-0 size-full">
        <path d="M6 1h14l10 10v24a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V5a4 4 0 0 1 4-4Z" className="fill-surface stroke-border" strokeWidth="1.5" />
        <path d="M20 1v7a3 3 0 0 0 3 3h7" className="stroke-border" strokeWidth="1.5" />
      </svg>
      {extension && (
        <span
          className={`absolute bottom-1.5 start-0 max-w-full truncate rounded px-1 text-[9px] font-bold leading-3.5 text-white ${badgeByExtension[extension] ?? "bg-neutral-600"}`}
        >
          {extension.slice(0, 4).toUpperCase()}
        </span>
      )}
    </span>
  );
}

const sizeFormat = () => new Intl.NumberFormat(getStoredLocale(), { maximumFractionDigits: 1 });

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat().format(bytes / 1024)} KB`;
  return `${sizeFormat().format(bytes / 1024 / 1024)} MB`;
}

/** A file shown as a card: icon, name, size, and an optional control at the end. */
export function FileCard({ fileName, size, end, onPress }: {
  fileName: string;
  size: number | null;
  end?: ReactNode;
  onPress?: () => void;
}) {
  const { t } = useLocale();
  const body = (
    <>
      <FileFormatIcon fileName={fileName} />
      <span className="min-w-0 flex-1 text-start">
        <span className="block truncate text-sm font-medium text-foreground">{fileName}</span>
        {size !== null && <span className="block text-xs text-muted">{formatFileSize(size)}</span>}
      </span>
    </>
  );

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3">
      {onPress ? (
        <button
          type="button"
          onClick={onPress}
          aria-label={t("posts.download").replace("{name}", fileName)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          {body}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
      )}
      {end}
    </div>
  );
}

/** Attachments of a post; pressing one downloads it. */
export function AttachmentList({ attachments }: { attachments: PostFileDto[] }) {
  const { t } = useLocale();
  const download = useDownloadPostFile();
  if (attachments.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {attachments.map((file) => (
        <li key={file.id}>
          <FileCard
            fileName={file.fileName}
            size={file.size}
            onPress={() => download(file.id, file.fileName).catch(() => toast.danger(t("common.genericError")))}
          />
        </li>
      ))}
    </ul>
  );
}
