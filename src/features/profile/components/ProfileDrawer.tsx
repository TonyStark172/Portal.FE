"use client";

import { useState, type ReactNode } from "react";
import { Alert, Button, Chip, Drawer, Separator, Skeleton } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useGetMyProfileQuery, useGetOrganizationQuery, type Gender, type ProfileDto } from "@/shared/api/generated/portalApi";
import { UserAvatar } from "@/shared/ui/UserAvatar";

const genderLabels: Record<NonNullable<Gender>, string> = { Male: "Nam", Female: "Nữ", Other: "Khác" };

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

/** "My profile" panel sliding in from the right, opened from the account menu. Read-only for now. */
export function ProfileDrawer({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const profile = useGetMyProfileQuery(undefined, { skip: !isOpen });
  const organization = useGetOrganizationQuery(undefined, { skip: !isOpen });
  const { user, permissions } = useCurrentUser();
  const [editNotice, setEditNotice] = useState(false);

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        {/* Content is the full-screen layer; the width belongs to the dialog (the panel itself). */}
        <Drawer.Dialog aria-label="Hồ sơ của tôi" className="flex w-full flex-col sm:max-w-md">
          <Drawer.Header>
            <Drawer.Heading>Hồ sơ của tôi</Drawer.Heading>
            <Drawer.CloseTrigger aria-label="Đóng" />
          </Drawer.Header>

          {/* HeroUI mutes body text by default; values are the content here, labels mute themselves. */}
          <Drawer.Body className="flex flex-col gap-4 text-foreground">
            {profile.isError ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Không tải được hồ sơ. Vui lòng thử lại.</Alert.Title>
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

            {editNotice && <p className="text-sm text-muted">Chức năng chỉnh sửa hồ sơ đang được xây dựng.</p>}
          </Drawer.Body>

          <Drawer.Footer className="justify-end gap-2">
            <Button variant="secondary" onPress={() => onOpenChange(false)}>
              Đóng
            </Button>
            <Button onPress={() => setEditNotice(true)}>Chỉnh sửa hồ sơ</Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}

type ProfileDetailsProps = {
  profile: ProfileDto;
  organizationName: string | undefined;
  roles: string[];
  permissionCount: number;
};

function ProfileDetails({ profile, organizationName, roles, permissionCount }: ProfileDetailsProps) {
  const primary = profile.assignments.find((a) => a.isPrimary);
  const subtitle = [primary?.positionName, organizationName].filter(Boolean).join(" · ");

  return (
    <>
      <div className="flex items-center gap-4">
        <UserAvatar fullName={profile.fullName} avatarUrl={profile.avatarUrl} size="lg" className="size-14 rounded-xl" />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{profile.fullName}</div>
          {subtitle && <div className="truncate text-sm text-muted">{subtitle}</div>}
        </div>
      </div>

      <Separator />

      <Section title="Thông tin cá nhân">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <Field label="Tên đăng nhập" value={profile.userName} />
          <Field
            label="Email"
            value={
              profile.email && (
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <span className="break-all">{profile.email}</span>
                  {profile.emailConfirmed && (
                    <Chip size="sm" variant="soft" color="success">
                      Đã xác minh
                    </Chip>
                  )}
                </span>
              )
            }
          />
          <Field label="Số điện thoại" value={profile.phoneNumber} />
          <Field label="Ngày sinh" value={profile.dateOfBirth && dateFormat.format(new Date(`${profile.dateOfBirth}T00:00:00`))} />
          <Field label="Giới tính" value={profile.gender && genderLabels[profile.gender]} />
          <Field label="Quê quán" value={profile.hometown} />
        </dl>
      </Section>

      <Separator />

      <Section title="Vị trí công tác">
        {profile.assignments.length === 0 ? (
          <p className="text-sm text-muted">Chưa được phân vào phòng ban nào.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {profile.assignments.map((a) => (
              <li key={`${a.departmentId}-${a.positionId}`} className="flex items-center justify-between gap-3">
                <span>
                  {a.positionName} — {a.departmentName}
                </span>
                {a.isPrimary && (
                  <Chip size="sm" variant="soft">
                    Chính
                  </Chip>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Separator />

      <Section title="Vai trò và quyền">
        {roles.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {roles.map((role) => (
              <Chip key={role} size="sm" variant="soft">
                {role}
              </Chip>
            ))}
          </div>
        )}
        <p className="text-sm text-muted">Có {permissionCount} quyền trong hệ thống.</p>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value || <span className="text-muted">Chưa cập nhật</span>}</dd>
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Đang tải hồ sơ">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-xl" />
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
