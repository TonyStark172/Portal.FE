"use client";

import type { ReactNode } from "react";
import { File, FileLetterP, FileLetterW, FileLetterX, FileText, FileZipper } from "@gravity-ui/icons";
import { toast } from "@heroui/react";
import type { PostFileDto } from "@/shared/api/generated/portalApi";
import { useDownloadPostFile } from "../hooks/usePostFile";

const kindsByExtension: Record<string, "word" | "excel" | "powerpoint" | "text" | "zip"> = {
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  csv: "excel",
  ppt: "powerpoint",
  pptx: "powerpoint",
  pdf: "text",
  txt: "text",
  zip: "zip",
};

/** An icon for the file type, from its extension. */
export function FileIcon({ fileName, className }: { fileName: string; className?: string }) {
  switch (kindsByExtension[fileName.split(".").pop()?.toLowerCase() ?? ""]) {
    case "word":
      return <FileLetterW aria-hidden className={className} />;
    case "excel":
      return <FileLetterX aria-hidden className={className} />;
    case "powerpoint":
      return <FileLetterP aria-hidden className={className} />;
    case "text":
      return <FileText aria-hidden className={className} />;
    case "zip":
      return <FileZipper aria-hidden className={className} />;
    default:
      return <File aria-hidden className={className} />;
  }
}

const sizeFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${sizeFormat.format(bytes / 1024)} KB`;
  return `${sizeFormat.format(bytes / 1024 / 1024)} MB`;
}

/** A file shown as a card: icon, name, size, and an optional control at the end. */
export function FileCard({ fileName, size, end, onPress }: {
  fileName: string;
  size: number | null;
  end?: ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <FileIcon fileName={fileName} className="size-5 shrink-0 text-muted" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-foreground">{fileName}</span>
        {size !== null && <span className="block text-xs text-muted">{formatFileSize(size)}</span>}
      </span>
    </>
  );

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      {onPress ? (
        <button
          type="button"
          onClick={onPress}
          aria-label={`Tải về ${fileName}`}
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
  const download = useDownloadPostFile();
  if (attachments.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {attachments.map((file) => (
        <li key={file.id}>
          <FileCard
            fileName={file.fileName}
            size={file.size}
            onPress={() => download(file.id, file.fileName).catch(() => toast.danger("Không tải được tệp. Vui lòng thử lại."))}
          />
        </li>
      ))}
    </ul>
  );
}
