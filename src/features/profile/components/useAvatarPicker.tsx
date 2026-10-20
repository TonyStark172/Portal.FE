"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "@heroui/react";
import { AvatarCropper } from "./AvatarCropper";

/**
 * Pictures Portal.BE accepts. A picked picture is re-encoded by the cropper (a 512 px JPEG, well under Portal.BE's
 * 2 MB), so the picked file itself may be larger: up to MAX_PICKED_MB, which keeps decoding it in the browser light.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PICKED_MB = 10;

/**
 * Picking a new avatar: from the file dialog (`open`) or a dropped file (`pickFile`), checked, then fitted into the
 * circle (AvatarCropper). `onPicked` receives the fitted picture; nothing is uploaded. `elements` (the hidden file
 * input and the cropper) must be rendered by the caller.
 */
export function useAvatarPicker(onPicked: (avatar: Blob) => void) {
  const fileInput = useRef<HTMLInputElement>(null);
  // The picture being fitted, and a key giving each picked picture a fresh cropper.
  const [picked, setPicked] = useState<{ file: File; key: number } | null>(null);

  function pickFile(file: File) {
    const invalid = !ALLOWED_TYPES.includes(file.type)
      ? "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP."
      : file.size > MAX_PICKED_MB * 1024 * 1024
        ? `Ảnh không được vượt quá ${MAX_PICKED_MB} MB.`
        : null;
    if (invalid) {
      toast.danger(invalid);
      return;
    }
    setPicked((current) => ({ file, key: (current?.key ?? 0) + 1 }));
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again
    if (file) pickFile(file);
  }

  const elements = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        className="hidden"
        aria-hidden
        tabIndex={-1}
        onChange={handleFile}
      />
      <AvatarCropper
        key={picked?.key}
        file={picked?.file ?? null}
        isSaving={false}
        onSave={(avatar) => {
          onPicked(avatar);
          setPicked(null);
        }}
        onCancel={() => setPicked(null)}
      />
    </>
  );

  return { open: () => fileInput.current?.click(), pickFile, elements };
}
