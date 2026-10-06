"use client";

import type { ReactNode } from "react";
import {
  At,
  Briefcase,
  Calendar,
  CircleCheckFill,
  CircleExclamationFill,
  Envelope,
  Gift,
  House,
  Key,
  Person,
  Shield,
  Smartphone,
} from "@gravity-ui/icons";
import { Chip, Separator, Tooltip } from "@heroui/react";
import type { Gender, ProfileDto } from "@/shared/api/generated/portalApi";
import { formatTenure } from "../lib/tenure";
import { AvatarPreview } from "./AvatarPreview";
import { InfoList, InfoRow } from "./InfoRow";

export const genderLabels: Record<NonNullable<Gender>, string> = { Male: "Nam", Female: "Nữ", Other: "Khác" };

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" });

/** "2002-02-17" → "17 tháng 2, 2002" */
const formatDate = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00`));

type ProfileDetailsProps = {
  profile: ProfileDto;
  organizationName: string | undefined;
  roles: string[];
  permissionCount: number;
};

/** The read-only view of a profile. */
export function ProfileDetails({ profile, organizationName, roles, permissionCount }: ProfileDetailsProps) {
  const primary = profile.assignments.find((a) => a.isPrimary);
  const subtitle = [primary?.positionName, organizationName].filter(Boolean).join(" · ");

  return (
    <>
      <ProfileHeader profile={profile} subtitle={subtitle} />

      <Separator />

      <ProfileSection title="Thông tin cá nhân">
        <InfoList>
          <InfoRow icon={<At />} label="Tên đăng nhập" value={profile.userName} />
          <InfoRow
            icon={<Envelope />}
            label="Email"
            value={profile.email && <EmailValue email={profile.email} isConfirmed={profile.emailConfirmed} />}
          />
          <InfoRow icon={<Smartphone />} label="Số điện thoại" value={profile.phoneNumber} />
          <InfoRow
            icon={<Gift />}
            label="Ngày sinh"
            value={profile.dateOfBirth && formatDate(profile.dateOfBirth)}
          />
          <InfoRow icon={<Person />} label="Giới tính" value={profile.gender && genderLabels[profile.gender]} />
          <InfoRow icon={<House />} label="Quê quán" value={profile.hometown && `Từ ${profile.hometown}`} />
        </InfoList>
      </ProfileSection>

      <Separator />

      <ProfileSection title="Công việc">
        <InfoList>
          {profile.assignments.length === 0 ? (
            <InfoRow icon={<Briefcase />} label="Vị trí công tác" value={null} />
          ) : (
            profile.assignments.map((a) => (
              <InfoRow
                key={`${a.departmentId}-${a.positionId}`}
                icon={<Briefcase />}
                label={a.isPrimary ? "Vị trí chính" : "Kiêm nhiệm"}
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    {a.positionName} tại {a.departmentName}
                    {a.isPrimary && (
                      <Chip size="sm" variant="soft">
                        Chính
                      </Chip>
                    )}
                  </span>
                }
              />
            ))
          )}
          <InfoRow
            icon={<Calendar />}
            label="Ngày gia nhập"
            value={
              profile.joinedOn && (
                <>
                  Gia nhập {formatDate(profile.joinedOn)} ·{" "}
                  <span className="font-medium whitespace-nowrap">{formatTenure(profile.joinedOn)}</span>
                </>
              )
            }
          />
        </InfoList>
      </ProfileSection>

      <Separator />

      <ProfileSection title="Vai trò và quyền">
        <InfoList>
          <InfoRow
            icon={<Shield />}
            label="Vai trò"
            value={
              roles.length > 0 && (
                <span className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <Chip key={role} size="sm" variant="soft">
                      {role}
                    </Chip>
                  ))}
                </span>
              )
            }
          />
          <InfoRow icon={<Key />} label="Quyền trong hệ thống" value={`${permissionCount} quyền trong hệ thống`} />
        </InfoList>
      </ProfileSection>
    </>
  );
}

/** Avatar, full name and an optional line under it (position · organization). */
export function ProfileHeader({
  profile,
  subtitle,
  children,
}: {
  profile: ProfileDto;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <AvatarPreview fullName={profile.fullName} avatarUrl={profile.avatarUrl} />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="truncate text-xl font-semibold text-foreground">{profile.fullName}</div>
        {subtitle && <div className="truncate text-sm text-muted">{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}

/** A titled group of the drawer, e.g. "Thông tin cá nhân". */
export function ProfileSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** An email address followed by an icon telling whether it is verified (named in a tooltip). */
export function EmailValue({ email, isConfirmed }: { email: string; isConfirmed: boolean }) {
  const status = isConfirmed ? "Đã xác minh" : "Chưa xác minh";

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="break-all">{email}</span>
      <Tooltip delay={0}>
        <Tooltip.Trigger aria-label={status} className="flex shrink-0 rounded-full">
          {isConfirmed ? (
            <CircleCheckFill className="size-4 text-success" />
          ) : (
            <CircleExclamationFill className="size-4 text-warning" />
          )}
        </Tooltip.Trigger>
        <Tooltip.Content>{status}</Tooltip.Content>
      </Tooltip>
    </span>
  );
}
