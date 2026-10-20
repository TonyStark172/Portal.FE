"use client";

import { useState } from "react";
import { Camera, TrashBin } from "@gravity-ui/icons";
import { AlertDialog, Button, Tooltip } from "@heroui/react";
import type { ProfileDto } from "@/shared/api/generated/portalApi";
import { ProfileHeader } from "./ProfileDetails";
import { useAvatarPicker } from "./useAvatarPicker";
import { useLocale } from "@/shared/i18n";

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
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const { t } = useLocale();
  const picker = useAvatarPicker((avatar) => onChange({ kind: "set", avatar, preview: URL.createObjectURL(avatar) }));

  const hasAvatar = change ? change.kind === "set" : Boolean(profile.avatarUrl);

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
              aria-label={t("profile.avatar.change")}
              onPress={picker.open}
            >
              <Camera className="size-4" />
            </Button>
            <Tooltip.Content>{t("profile.avatar.change")}</Tooltip.Content>
          </Tooltip>
          {hasAvatar && (
            <Tooltip delay={0}>
              <Button isIconOnly size="sm" variant="ghost" aria-label={t("profile.avatar.remove")} onPress={() => setConfirmOpen(true)}>
                <TrashBin className="size-4" />
              </Button>
              <Tooltip.Content>{t("profile.avatar.remove")}</Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </ProfileHeader>

      {picker.elements}

      <AlertDialog.Backdrop isOpen={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-sm">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>{t("profile.avatar.removeTitle")}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{t("profile.avatar.removeDescription")}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                {t("profile.cancel")}
              </Button>
              <Button variant="danger" onPress={handleRemove}>
                {t("profile.avatar.remove")}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
