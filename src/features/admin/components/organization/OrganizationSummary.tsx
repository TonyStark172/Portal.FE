"use client";

import { useId, type ComponentType, type ReactNode, type SVGProps } from "react";
import { Briefcase, Calendar, Clock } from "@gravity-ui/icons";
import { Skeleton } from "@heroui/react";
import { useGetOrganizationQuery, useGetWorkWeekQuery } from "@/shared/api/generated/portalApi";
import { summarizeWorkWeek, type WorkDay } from "@/features/meetings/workWeek";
import { useLocale } from "@/shared/i18n";

/*
 * What the organization page has saved, at a glance, one summary beside each part (SettingsSection's `aside`). Each
 * shows what the server holds, not what is being typed, so it changes when its part is saved (the saves refresh both
 * reads).
 */

/** The organization: its name and short name, and when it was founded. */
export function OrganizationDetailsSummary() {
  const { t, locale } = useLocale();
  const organization = useGetOrganizationQuery();
  const data = organization.data;

  const founded = data?.foundedOn
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" })
      // A day, not a moment: read at noon so no time zone can move it to the day before.
      .format(new Date(`${data.foundedOn}T12:00:00`))
    : null;

  return (
    <Summary title={t("admin.organization")}>
      {data ? (
        <>
          <Item icon={Briefcase} title={data.name} detail={data.shortName} />
          <Item icon={Calendar} title={t("admin.organizationFoundedOn")} detail={founded ?? t("admin.noFoundingDate")} />
        </>
      ) : (
        <Skeleton className="h-16 rounded-xl" />
      )}
    </Summary>
  );
}

/** The work week in a few words. */
export function WorkWeekSummary() {
  const { t } = useLocale();
  const workWeek = useGetWorkWeekQuery();

  return (
    <Summary title={t("settings.meetings.workWeek")}>
      {workWeek.data
        ? <Item icon={Clock} title={summarizeWorkWeek(workWeek.data.days as WorkDay[], t)} />
        : <Skeleton className="h-10 rounded-xl" />}
    </Summary>
  );
}

function Summary({ title, children }: { title: string; children: ReactNode }) {
  const heading = useId();
  return (
    <aside aria-labelledby={heading} className="flex flex-col gap-4">
      <h3 id={heading} className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </aside>
  );
}

function Item({ icon: Icon, title, detail }: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; detail?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="break-words text-sm font-medium text-foreground">{title}</p>
        {detail && <p className="break-words text-xs text-muted">{detail}</p>}
      </div>
    </div>
  );
}
