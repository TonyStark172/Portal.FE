"use client";

import { useRef } from "react";
import { Picture, Xmark } from "@gravity-ui/icons";
import { Button, Spinner, Tooltip } from "@heroui/react";
import { bannerColors, type BannerColor } from "../../editor/palette";
import { getPreview } from "../../editor/previews";
import { IMAGE_TYPES } from "../../lib/fileRules";
import { AnnouncementBanner } from "../AnnouncementBanner";

export type BannerImage = { id: string | null; previewId: string | null; uploading: boolean };

type BannerEditorProps = {
  subject: string;
  subhead: string;
  color: BannerColor;
  image: BannerImage | null;
  onSubjectChange: (value: string) => void;
  onSubheadChange: (value: string) => void;
  onColorChange: (value: BannerColor) => void;
  onImagePick: (file: File) => void;
  onImageRemove: () => void;
};

/** Headline area of an announcement in the composer: title, subtitle, and a colour or an image behind them. */
export function BannerEditor(props: BannerEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { image } = props;

  return (
    <div className="flex flex-col gap-2">
      <AnnouncementBanner
        bannerColor={image ? null : props.color}
        bannerImageId={image?.id}
        localImageUrl={getPreview(image?.previewId)}
      >
        <input
          aria-label="Tiêu đề thông báo"
          placeholder="Tiêu đề thông báo"
          maxLength={200}
          value={props.subject}
          onChange={(event) => props.onSubjectChange(event.target.value)}
          className="w-full bg-transparent text-2xl font-bold text-white outline-none placeholder:text-white/70"
        />
        <input
          aria-label="Phụ đề"
          placeholder="Thêm phụ đề (không bắt buộc)"
          maxLength={300}
          value={props.subhead}
          onChange={(event) => props.onSubheadChange(event.target.value)}
          className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/70"
        />
        {image?.uploading && (
          <span role="status" aria-label="Đang tải ảnh nền" className="absolute end-0 top-0">
            <Spinner size="sm" color="current" />
          </span>
        )}
      </AnnouncementBanner>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Nền:</span>
        <div role="radiogroup" aria-label="Màu nền" className="flex gap-1.5">
          {bannerColors.map((color) => (
            <button
              key={color.name}
              type="button"
              role="radio"
              aria-checked={!image && props.color === color.name}
              aria-label={color.label}
              data-color={color.name}
              onClick={() => {
                props.onColorChange(color.name);
                if (image) props.onImageRemove();
              }}
              className="post-banner size-6 rounded-full outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-focus aria-checked:ring-2 aria-checked:ring-foreground"
            />
          ))}
        </div>

        {image ? (
          <Button size="sm" variant="ghost" onPress={props.onImageRemove}>
            <Xmark className="size-4" />
            Bỏ ảnh nền
          </Button>
        ) : (
          <Tooltip delay={400}>
            <Button size="sm" variant="ghost" onPress={() => fileInput.current?.click()}>
              <Picture className="size-4" />
              Ảnh nền
            </Button>
            <Tooltip.Content>Dùng ảnh làm nền thông báo</Tooltip.Content>
          </Tooltip>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(",")}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) props.onImagePick(file);
          }}
        />
      </div>
    </div>
  );
}
