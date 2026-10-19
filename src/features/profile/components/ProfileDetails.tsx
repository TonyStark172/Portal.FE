"use client";

import type { ReactNode } from "react";
import {
  At,
  Briefcase,
  Calendar,
  CircleExclamationFill,
  Clock,
  Envelope,
  Gift,
  House,
  Key,
  Person,
  Shield,
  Smartphone,
} from "@gravity-ui/icons";
import { Chip, Separator, Tooltip } from "@heroui/react";
import type { ProfileDto } from "@/shared/api/generated/portalApi";
import { VerifiedBadge } from "@/shared/ui/VerifiedBadge";
import { useLocale } from "@/shared/i18n";
import { AvatarPreview } from "./AvatarPreview";
import { InfoList, InfoRow } from "./InfoRow";

/** "2002-02-17" → "17 tháng 2, 2002" */
const formatDate = (isoDate: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${isoDate}T00:00:00`));

type ProfileDetailsProps = {
  profile: ProfileDto;
  organizationName: string | undefined;
  roles: string[];
  permissionCount: number;
};

/** The read-only view of a profile. */
export function ProfileDetails({ profile, organizationName, roles, permissionCount }: ProfileDetailsProps) {
  const { locale, t } = useLocale();
  const primary = profile.assignments.find((a) => a.isPrimary);
  const subtitle = [primary?.positionName, organizationName].filter(Boolean).join(" · ");

  return (
    <>
      <ProfileHeader profile={profile} subtitle={subtitle} />

      <Separator />

      <ProfileSection title={t("profile.personalInfo")}>
        <InfoList>
          <InfoRow icon={<At />} label={t("profile.username")} value={profile.userName} />
          <InfoRow
            icon={<Envelope />}
            label={t("profile.email")}
            value={profile.email && <EmailValue email={profile.email} isConfirmed={profile.emailConfirmed} />}
          />
          <InfoRow icon={<Smartphone />} label={t("profile.phone")} value={profile.phoneNumber} />
          <InfoRow
            icon={<Gift />}
            label={t("profile.birthDate")}
            value={profile.dateOfBirth && formatDate(profile.dateOfBirth, locale)}
          />
          <InfoRow icon={<Person />} label={t("profile.gender")} value={profile.gender && t(profile.gender === "Male" ? "dashboard.male" : "dashboard.female")} />
          <InfoRow icon={<House />} label={t("profile.hometown")} value={profile.hometown && t("profile.from").replace("{place}", profile.hometown)} />
        </InfoList>
      </ProfileSection>

      <Separator />

      <ProfileSection title={t("profile.work")}>
        <InfoList>
          {profile.assignments.length === 0 ? (
            <InfoRow icon={<Briefcase />} label={t("profile.workPosition")} value={null} />
          ) : (
            profile.assignments.map((a) => (
              <InfoRow
                key={a.departmentId}
                icon={<Briefcase />}
                label={a.isPrimary ? t("profile.primaryPosition") : t("profile.additionalPosition")}
                value={
                  <span className="flex flex-wrap items-center gap-2">
                    {/* Chart-placed people have no position: the department stands alone. */}
                    {a.positionName ? `${a.positionName} ${t("profile.at")} ${a.departmentName}` : a.departmentName}
                    {a.role === "Head" && (
                      <Chip size="sm" variant="soft" color="accent">
                        {t("profile.roleHead")}
                      </Chip>
                    )}
                    {a.role === "Deputy" && (
                      <Chip size="sm" variant="soft" color="accent">
                        {t("profile.roleDeputy")}
                      </Chip>
                    )}
                    {a.isPrimary && (
                      <Chip size="sm" variant="soft">
                        {t("profile.primary")}
                      </Chip>
                    )}
                  </span>
                }
              />
            ))
          )}
          <InfoRow
            icon={<Calendar />}
            label={t("profile.joinedDate")}
            value={profile.joinedOn && t("profile.joined").replace("{date}", formatDate(profile.joinedOn, locale))}
          />
          {/* Every stay added up (Portal.BE), so coming back does not start it again. */}
          <InfoRow
            icon={<Clock />}
            label={t("profile.seniority")}
            value={
              profile.seniorityDays != null && (
                <span className="font-medium">{formatSeniorityLocalized(profile.seniorityDays, locale)}</span>
              )
            }
          />
        </InfoList>
      </ProfileSection>

      <Separator />

      <ProfileSection title={t("profile.rolesPermissions")}>
        <InfoList>
          <InfoRow
            icon={<Shield />}
            label={t("profile.role")}
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
          <InfoRow icon={<Key />} label={t("profile.systemPermissions")} value={t("profile.systemPermissions").replace("{count}", String(permissionCount))} />
        </InfoList>
      </ProfileSection>
    </>
  );
}

function formatSeniorityLocalized(days: number | null | undefined, locale: string) {
  if (days == null) return "—";
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (locale === "en-US") return years || months ? `${years ? `${years}y ` : ""}${months ? `${months}mo` : ""}`.trim() : `${days}d`;
  return years || months ? `${years ? `${years} năm ` : ""}${months ? `${months} tháng` : ""}`.trim() : `${days} ngày`;
}

/** Avatar, full name and an optional line under it (position · organization). */
export function ProfileHeader({
  profile,
  subtitle,
  avatarSrc,
  children,
}: {
  profile: ProfileDto;
  subtitle?: string;
  /** An avatar not saved yet (an object URL), or null for none; leave it out for the saved avatar. */
  avatarSrc?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4">
      <AvatarPreview fullName={profile.fullName} avatarUrl={profile.avatarUrl} src={avatarSrc} />
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
  const { t } = useLocale();
  const status = isConfirmed ? t("profile.verified") : t("profile.notVerified");

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="break-all">{email}</span>
      <Tooltip delay={0}>
        <Tooltip.Trigger aria-label={status} className="flex shrink-0 rounded-full">
          {isConfirmed ? (
            <VerifiedBadge className="size-[18px]" />
          ) : (
            <CircleExclamationFill className="size-4 text-warning" />
          )}
        </Tooltip.Trigger>
        <Tooltip.Content>{status}</Tooltip.Content>
      </Tooltip>
    </span>
  );
}
