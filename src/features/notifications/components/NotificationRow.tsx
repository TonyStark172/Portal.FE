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
 * comment, post or meeting, and how long ago. An unread one is tinted and has a dot. The whole row is one button
 * (so the keyboard reaches and presses it) which asks `onOpen` to go to what it is about.
 */
export function NotificationRow({ item, onOpen }: { item: NotificationDto; onOpen: (item: NotificationDto) => void }) {
  const { t, locale } = useLocale();
  const detail =
    item.meetingId !== null && item.meetingStartUtc
      ? [item.excerpt, formatBusinessTime(item.meetingStartUtc, locale)].filter(Boolean).join(" · ")
      : item.excerpt;
  // The tint takes the muted grey below the contrast small text needs in some themes, so an unread row's is darker.
  const secondary = item.isRead ? "text-muted" : "text-foreground/70";

  return (
    <li data-unread={item.isRead ? undefined : ""} className={item.isRead ? "" : "bg-accent/10"}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-default/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        {item.actor || item.meetingId === null ? (
          <UserAvatar fullName={item.actor?.fullName} avatarUrl={item.actor?.avatarUrl} size="md" className="shrink-0" />
        ) : (
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-default text-muted">
            <Calendar className="size-5" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={`block text-sm text-foreground ${item.isRead ? "" : "font-medium"}`}>{notificationSentence(item, t)}</span>
          {detail && <span className={`block truncate text-sm ${secondary}`}>{detail}</span>}
          <time dateTime={item.occurredAt} className={`text-xs ${secondary}`}>
            {formatPostTime(item.occurredAt, undefined, locale)}
          </time>
        </span>
        {!item.isRead && (
          <>
            <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full bg-[var(--accent-text,var(--accent))]" />
            <span className="sr-only">{t("notifications.unread")}</span>
          </>
        )}
      </button>
    </li>
  );
}
