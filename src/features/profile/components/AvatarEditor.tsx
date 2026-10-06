"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera, TrashBin } from "@gravity-ui/icons";
import { AlertDialog, Button, Tooltip, toast } from "@heroui/react";
import { useDeleteMyAvatarMutation, type ProfileDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useUploadMyAvatarMutation } from "../api";
import { ProfileHeader } from "./ProfileDetails";

/** Same limits as Portal.BE, checked first so a wrong file fails without an upload. */
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 2;

/** The avatar with "change" and "remove" actions; each applies at once, independent of the profile form. */
export function AvatarEditor({ profile }: { profile: ProfileDto }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [upload, { isLoading: isUploading }] = useUploadMyAvatarMutation();
  const [remove, { isLoading: isRemoving }] = useDeleteMyAvatarMutation();
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again
    if (!file) return;

    const invalid = !ALLOWED_TYPES.includes(file.type)
      ? "Chỉ chấp nhận ảnh JPG, PNG hoặc WebP."
      : file.size > MAX_SIZE_MB * 1024 * 1024
        ? `Ảnh đại diện không được vượt quá ${MAX_SIZE_MB} MB.`
        : null;
    if (invalid) {
      toast.danger(invalid);
      return;
    }

    try {
      await upload(file).unwrap();
      toast.success("Đã cập nhật ảnh đại diện");
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? "Không tải được ảnh lên.");
    }
  }

  async function handleRemove() {
    try {
      await remove().unwrap();
      setConfirmOpen(false);
      toast.success("Đã xoá ảnh đại diện");
    } catch (error) {
      toast.danger(toApiProblem(error).detail ?? "Không xoá được ảnh.");
    }
  }

  return (
    <>
      <ProfileHeader profile={profile}>
        <div className="flex gap-1">
          <Tooltip delay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label="Đổi ảnh"
              isPending={isUploading}
              onPress={() => fileInput.current?.click()}
            >
              <Camera className="size-4" />
            </Button>
            <Tooltip.Content>Đổi ảnh</Tooltip.Content>
          </Tooltip>
          {profile.avatarUrl && (
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

      <AlertDialog.Backdrop isOpen={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-sm">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Xoá ảnh đại diện?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>Ảnh sẽ bị xoá và chữ cái đầu tên của bạn được hiển thị thay thế.</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Huỷ
              </Button>
              <Button variant="danger" isPending={isRemoving} onPress={handleRemove}>
                Xoá ảnh
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
