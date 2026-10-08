"use client";

import { Modal } from "@heroui/react";

type ImagePreviewModalProps = {
  /** Object URL or any URL the browser can load without credentials. */
  src: string | undefined;
  alt: string;
  /** Accessible name of the dialog, e.g. "Ảnh đại diện của Nguyễn Văn An". */
  label: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Crop to a square (avatars); otherwise the whole image is shown. */
  square?: boolean;
};

/** An image shown large over a blurred page, up to 640 px wide; closes with ✕, Esc or a click outside. */
export function ImagePreviewModal({ src, alt, label, isOpen, onOpenChange, square = false }: ImagePreviewModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
      <Modal.Container placement="center">
        <Modal.Dialog
          aria-label={label}
          className="w-[min(640px,calc(100vw-2rem))] max-w-none bg-transparent p-0 shadow-none"
        >
          <Modal.CloseTrigger aria-label="Đóng" />
          {src && (
            // eslint-disable-next-line @next/next/no-img-element -- an object URL of an authenticated download, not a static asset next/image could optimise
            <img
              src={src}
              alt={alt}
              className={
                square
                  ? "aspect-square w-full rounded-2xl object-cover"
                  : "max-h-[85svh] w-full rounded-2xl bg-default object-contain"
              }
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
