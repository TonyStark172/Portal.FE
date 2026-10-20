"use client";

import { useLocale } from "@/shared/i18n/LocaleProvider";
import type { MeetingState } from "../meetingState";

/** The small red dot before the title of a meeting under way, pulsing unless motion is reduced (globals.css). */
export function LiveDot() {
  return <span aria-hidden className="meeting-live-dot" />;
}

/**
 * "Đang họp" after the title of a meeting under way (`label`: another word, "Đang diễn ra" for an event), for screen
 * readers only: on screen the red dot says it.
 */
export function LiveTag({ label }: { label?: string }) {
  const { t } = useLocale();
  return <span className="meeting-live-tag sr-only">{label ?? t("meetings.ongoing")}</span>;
}

/**
 * A meeting's title in a list (the sidebar, a day's meetings): struck through once it is over (`meeting-finished` on
 * the row fades it) and said so to a screen reader; a live dot before it while it is on (its words for screen readers).
 */
export function StatefulTitle({ title, state, className = "", liveLabel }: { title: string; state: MeetingState; className?: string; liveLabel?: string }) {
  const { t } = useLocale();
  return (
    <span className={`flex min-w-0 items-center ${className}`}>
      {state === "ongoing" && <LiveDot />}
      <span className="meeting-row-title min-w-0 truncate" title={title}>{title}</span>
      {state === "ongoing" && <LiveTag label={liveLabel} />}
      {state === "finished" && <span className="sr-only"> {t("meetings.finishedNote")}</span>}
    </span>
  );
}
