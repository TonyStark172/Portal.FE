"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, TrashBin } from "@gravity-ui/icons";
import { AlertDialog, Button, Tooltip, toast } from "@heroui/react";
import type { ProfileDto } from "@/shared/api/generated/portalApi";
import { AvatarCropper } from "./AvatarCropper";
import { ProfileHeader } from "./ProfileDetails";

/**
 * Pictures Portal.BE accepts. A picked picture is re-encoded by the cropper (a 512 px JPEG, well under Portal.BE's
 * 2 MB), so the picked file itself may be larger: up to MAX_PICKED_MB, which keeps decoding it in the browser light.
 */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PICKED_MB = 10;

/** A change of avatar waiting for the profile form to be saved: a new picture (and its preview), or none. */
export type AvatarChange = { kind: "set"; avatar: Blob; preview: string } | { kind: "remove" };

/**
 * The avatar with "change" and "remove" actions, part of the profile form: a picked picture is fitted into the
 * circle (AvatarCropper) and shown, a removal is shown too, and either is only applied when the form is saved
 * ("Huỷ" drops it). The form owns the change and frees the preview's object URL.
 */
export function AvatarEditor({ profile, change, onChange }: {
  profile: ProfileDto;
  change: AvatarChange | null;
  onChange: (change: AvatarChange | null) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  // The picture being fitted, and a key giving each picked picture a fresh cropper.
  const [picked, setPicked] = useState<{ file: File; key: number } | null>(null);

  const hasAvatar = change ? change.kind === "set" : Boolean(profile.avatarUrl);

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again
    if (!file) return;

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

  function handleCropped(avatar: Blob) {
    onChange({ kind: "set", avatar, preview: URL.createObjectURL(avatar) });
    setPicked(null);
  }

  function handleRemove() {
    // A new picture not saved yet simply goes; a saved one is marked for removal.
    onChange(profile.avatarUrl ? { kind: "remove" } : null);
    setConfirmOpen(false);
  }

  return (
    <>
      <ProfileHeader
        profile={profile}
        avatarSrc={change?.kind === "set" ? change.preview : change?.kind === "remove" ? null : undefined}
      >
        <div className="flex gap-1">
          <Tooltip delay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label="Đổi ảnh"
              onPress={() => fileInput.current?.click()}
            >
              <Camera className="size-4" />
            </Button>
            <Tooltip.Content>Đổi ảnh</Tooltip.Content>
          </Tooltip>
          {hasAvatar && (
            <Tooltip delay={0}>
              <Button isIconOnly size="sm" variant="ghost" aria-label="Xoá ảnh" onPress={() => setConfirmOpen(true)}>
                <TrashBin className="size-4" />
              </Button>
              <Tooltip.Content>Xoá ảnh</Tooltip.Content>
            </Tooltip>
          )}
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ALLOWED_TYPES.join(",")}
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={handleFile}
        />
      </ProfileHeader>

      <AvatarCropper
        key={picked?.key}
        file={picked?.file ?? null}
        isSaving={false}
        onSave={handleCropped}
        onCancel={() => setPicked(null)}
      />

      <AlertDialog.Backdrop isOpen={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-sm">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Xoá ảnh đại diện?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Khi bạn lưu hồ sơ, ảnh sẽ bị xoá và chữ cái đầu tên của bạn được hiển thị thay thế.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Huỷ
              </Button>
              <Button variant="danger" onPress={handleRemove}>
                Xoá ảnh
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
