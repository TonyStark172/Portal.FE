"use client";

import { Modal } from "@heroui/react";
import { Gift, Medal } from "@gravity-ui/icons";
import { BUSINESS_OFFSET, formatBusinessTime } from "@/features/meetings/businessTime";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import type { Occasion } from "../eventTypes";

/** "Sinh nhật", or "Kỷ niệm 3 năm làm việc". */
export const occasionLabel = (occasion: Occasion, t: (key: string) => string) =>
  occasion.kind === "Birthday" ? t("events.birthday") : t("events.anniversary").replace("{years}", String(occasion.years ?? 0));

/** The small icon of an occasion: a gift for a birthday, a medal for a work anniversary. */
export function OccasionIcon({ occasion, className = "size-3.5" }: { occasion: Pick<Occasion, "kind">; className?: string }) {
  const Icon = occasion.kind === "Birthday" ? Gift : Medal;
  return <Icon aria-hidden className={`occasion-icon shrink-0 ${className}`} />;
}

/** A birthday or a work anniversary, opened from the calendar: the person's photo, name and department, and the day. */
export function OccasionCard({ occasion, onClose }: { occasion: Occasion | null; onClose: () => void }) {
  const { t, locale } = useLocale();
  const day = occasion && formatBusinessTime(`${occasion.date}T12:00:00${BUSINESS_OFFSET}`, locale, { weekday: "long", day: "2-digit", month: "2-digit" });
  return (
    <Modal.Backdrop isOpen={occasion !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <Modal.Container size="xs" placement="center">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("meetings.close")} />
          {occasion && (
            <Modal.Body className={`occasion-card occasion-${occasion.kind === "Birthday" ? "birthday" : "anniversary"} flex flex-col items-center gap-2 py-2 text-center`}>
              <UserAvatar fullName={occasion.fullName} avatarUrl={occasion.avatarUrl} size="lg" />
              <Modal.Heading className="break-words text-lg font-semibold leading-snug">{occasion.fullName}</Modal.Heading>
              {occasion.departmentName && <p className="text-sm text-muted">{occasion.departmentName}</p>}
              <p className="occasion-card-label mt-1 flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium">
                <OccasionIcon occasion={occasion} />{occasionLabel(occasion, t)}
              </p>
              <p className="text-xs text-muted">{day && day.charAt(0).toLocaleUpperCase() + day.slice(1)}</p>
            </Modal.Body>
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
