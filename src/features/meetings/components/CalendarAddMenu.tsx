"use client";

import type { ReactElement } from "react";
import { Dropdown, Label, type Key } from "@heroui/react";
import { Calendar, Persons } from "@gravity-ui/icons";
import { useLocale } from "@/shared/i18n/LocaleProvider";

/**
 * "Thêm" for those who may add company events: a menu of a meeting or an event, opened by `trigger` (the toolbar's
 * own button). Others keep the plain "Thêm cuộc họp" button instead of this menu.
 */
export function CalendarAddMenu({ trigger, onAddMeeting, onAddEvent }: { trigger: ReactElement; onAddMeeting: () => void; onAddEvent: () => void }) {
  const { t } = useLocale();
  return (
    <Dropdown>
      {trigger}
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={t("events.addMenu")} onAction={(key: Key) => (key === "event" ? onAddEvent : onAddMeeting)()}>
          <Dropdown.Item id="meeting" textValue={t("events.addMeeting")}>
            <Persons className="size-4 shrink-0 text-muted" />
            <Label>{t("events.addMeeting")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="event" textValue={t("events.addEvent")}>
            <Calendar className="size-4 shrink-0 text-muted" />
            <Label>{t("events.addEvent")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
