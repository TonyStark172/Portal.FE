"use client";

import { useState } from "react";
import { Alert, Button, Drawer, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useLocale } from "@/shared/i18n";
import { useGetMyProfileQuery, useGetOrganizationQuery } from "@/shared/api/generated/portalApi";
import { ProfileDetails } from "./ProfileDetails";
import { ProfileForm } from "./ProfileForm";

/** "My profile" panel sliding in from the right, opened from the account menu: view, then edit. */
export function ProfileDrawer({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const profile = useGetMyProfileQuery(undefined, { skip: !isOpen });
  const organization = useGetOrganizationQuery(undefined, { skip: !isOpen });
  const { user, permissions } = useCurrentUser();
  const { t } = useLocale();
  const [isEditing, setEditing] = useState(false);

  function handleOpenChange(open: boolean) {
    onOpenChange(open);
    if (!open) setEditing(false); // unsaved changes are discarded
  }

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Drawer.Content placement="right">
        {/* Content is the full-screen layer; the width belongs to the dialog (the panel itself). */}
        <Drawer.Dialog className="w-full sm:max-w-md">
          <Drawer.CloseTrigger aria-label={t("common.close")} />
          <Drawer.Header>
            <Drawer.Heading className="text-lg font-semibold">
              {isEditing ? t("profile.edit") : t("profile.title")}
            </Drawer.Heading>
          </Drawer.Header>

          {isEditing && profile.data ? (
            <ProfileForm profile={profile.data} onDone={() => setEditing(false)} />
          ) : (
            <>
              {/* HeroUI mutes body text by default; values are the content here, labels mute themselves. */}
              <Drawer.Body className="flex flex-col gap-4 text-foreground">
                {profile.isError ? (
                  <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content>
                      <Alert.Title>{t("profile.loadError")}</Alert.Title>
                    </Alert.Content>
                  </Alert>
                ) : !profile.data ? (
                  <ProfileSkeleton />
                ) : (
                  <ProfileDetails
                    profile={profile.data}
                    organizationName={organization.data?.name}
                    roles={user?.roles.map((r) => r.name ?? "").filter(Boolean) ?? []}
                    permissionCount={permissions.length}
                  />
                )}
              </Drawer.Body>

              <Drawer.Footer className="justify-end gap-2">
                <Button slot="close" variant="secondary">
                  {t("common.close")}
                </Button>
                <Button isDisabled={!profile.data} onPress={() => setEditing(true)}>
                  {t("profile.edit")}
                </Button>
              </Drawer.Footer>
            </>
          )}
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading profile" className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/3 rounded-md" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </div>
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-4 w-full rounded-md" />
      ))}
    </div>
  );
}
