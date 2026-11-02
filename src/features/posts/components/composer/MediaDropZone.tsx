"use client";

import { useEffect, useRef } from "react";
import { CloudArrowUpIn } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { DropZone, Text, type DropZoneProps } from "react-aria-components/DropZone";
import { useLocale } from "@/shared/i18n";
import { IMAGE_TYPES, MAX_IMAGE_MB, MAX_VIDEO_MB, VIDEO_TYPES, mediaKindOf } from "../../lib/fileRules";

type MediaDropZoneProps = {
  /** The images and videos dropped, pasted or picked (types and sizes are the caller's to report). */
  onFiles: (files: File[]) => void;
  /** Whether more than one file is taken at a time. */
  multiple?: boolean;
  isDisabled?: boolean;
  className?: string;
};

/** A dashed area to drop images and videos on, or to press to choose them. */
export function MediaDropZone({ onFiles, multiple = true, isDisabled = false, className }: MediaDropZoneProps) {
  const { t } = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const openPicker = () => input.current?.click();

  // The zone's focus stop is a hidden button that swallows Enter and Space for itself, and the zone takes no key props.
  useEffect(() => {
    const element = zone.current;
    if (!element || isDisabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && event.target !== button.current) input.current?.click();
    };
    element.addEventListener("keydown", onKeyDown, true);
    return () => element.removeEventListener("keydown", onKeyDown, true);
  }, [isDisabled]);

  const give = (files: File[]) => {
    const taken = multiple ? files : files.slice(0, 1);
    if (taken.length > 0) onFiles(taken);
  };

  const handleDrop: DropZoneProps["onDrop"] = async (event) => {
    const dropped = await Promise.all(
      event.items.flatMap((item) => (item.kind === "file" ? [item.getFile()] : [])),
    );
    give(dropped.filter((file) => mediaKindOf(file) !== null));
  };

  return (
    <>
      <DropZone
        ref={zone}
        data-media-drop-zone=""
        isDisabled={isDisabled}
        onDrop={(event) => void handleDrop(event)}
        // The area opens the picker by click; its button has its own press.
        onClickCapture={(event) => {
          if (!isDisabled && !button.current?.contains(event.target as Node)) openPicker();
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center outline-none transition-colors hover:bg-default/40 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[drop-target]:border-accent data-[drop-target]:bg-accent/10 data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus ${className ?? ""}`}
      >
        <CloudArrowUpIn className="size-8 text-muted" />
        <Text slot="label" className="text-sm font-medium text-foreground">
          {t(multiple ? "posts.dropZone.label" : "posts.dropZone.labelSingle")}
        </Text>
        <p className="text-xs text-muted">
          {t("posts.dropZone.description")
            .replace("{imageMb}", String(MAX_IMAGE_MB))
            .replace("{videoMb}", String(MAX_VIDEO_MB))}
        </p>
        <Button ref={button} size="sm" variant="outline" isDisabled={isDisabled} onPress={openPicker}>
          {t("posts.dropZone.choose")}
        </Button>
      </DropZone>
      <input
        ref={input}
        type="file"
        multiple={multiple}
        accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          give(files);
        }}
      />
    </>
  );
}
