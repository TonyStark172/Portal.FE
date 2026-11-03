"use client";

import { Calendar } from "@gravity-ui/icons";
import { formatBusinessTime } from "@/features/meetings/businessTime";
import { formatPostTime } from "@/features/posts/lib/time";
import type { NotificationDto } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { notificationSentence } from "../lib/notificationText";

/**
 * One notification: who did it (the calendar for a meeting no one is named for), what they did, a line from the
 * comment, post or meeting, and how long ago. An unread one is tinted and has a dot.
 */
export function NotificationRow({ item }: { item: NotificationDto }) {
  const { t, locale } = useLocale();
  const detail =
    item.meetingId !== null && item.meetingStartUtc
      ? [item.excerpt, formatBusinessTime(item.meetingStartUtc, locale)].filter(Boolean).join(" · ")
      : item.excerpt;

  return (
    <li data-unread={item.isRead ? undefined : ""} className={`flex items-start gap-3 px-4 py-3 ${item.isRead ? "" : "bg-accent/10"}`}>
      {item.actor || item.meetingId === null ? (
        <UserAvatar fullName={item.actor?.fullName} avatarUrl={item.actor?.avatarUrl} size="md" className="shrink-0" />
      ) : (
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-default text-muted">
          <Calendar className="size-5" />
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={`text-sm text-foreground ${item.isRead ? "" : "font-medium"}`}>{notificationSentence(item, t)}</p>
        {detail && <p className="truncate text-sm text-muted">{detail}</p>}
        <time dateTime={item.occurredAt} className="text-xs text-muted">
          {formatPostTime(item.occurredAt, undefined, locale)}
        </time>
      </div>
      {!item.isRead && (
        <>
          <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
          <span className="sr-only">{t("notifications.unread")}</span>
        </>
      )}
    </li>
  );
}
