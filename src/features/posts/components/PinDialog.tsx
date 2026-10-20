"use client";

import { useState } from "react";
import { Pin } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Calendar,
  DateField,
  DatePicker,
  Label,
  Modal,
  Radio,
  RadioGroup,
  toast,
} from "@heroui/react";
import { getLocalTimeZone, today, type DateValue } from "@internationalized/date";
import { usePinPostMutation, type PostDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";

const DAY = 24 * 60 * 60 * 1000;

const durations = [
  { key: "1d", keyName: "posts.oneDay", days: 1 }, { key: "3d", keyName: "posts.threeDays", days: 3 },
  { key: "7d", keyName: "posts.oneWeek", days: 7 }, { key: "30d", keyName: "posts.oneMonth", days: 30 },
  { key: "forever", keyName: "posts.forever", days: null }, { key: "date", keyName: "posts.untilDate", days: null },
] as const;

type DurationKey = (typeof durations)[number]["key"];

type PinDialogProps = {
  post: PostDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Pins a post to the top of the feed for a chosen time, or changes when an existing pin ends. */
export function PinDialog({ post, isOpen, onOpenChange }: PinDialogProps) {
  const { t } = useLocale();
  const [pinPost, { isLoading }] = usePinPostMutation();
  const [duration, setDuration] = useState<DurationKey>("7d");
  const [date, setDate] = useState<DateValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tomorrow = today(getLocalTimeZone()).add({ days: 1 });

  /** The pin ends at this moment; null keeps it until unpinned. The chosen day is included in full. */
  function until(): string | null {
    if (duration === "forever") return null;
    if (duration === "date") return date ? date.add({ days: 1 }).toDate(getLocalTimeZone()).toISOString() : null;
    const days = durations.find((d) => d.key === duration)!.days!;
    return new Date(Date.now() + days * DAY).toISOString();
  }

  async function submit() {
    setError(null);
    try {
      await pinPost({ id: post.id, pinPostCommand: { until: until() } }).unwrap();
      toast.success(post.isPinned ? t("posts.changePin") : t("posts.pinSuccess"));
      onOpenChange(false);
    } catch (problem) {
      setError(toApiProblem(problem).detail ?? t("posts.pinError"));
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("posts.close")} />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Pin className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{post.isPinned ? t("posts.changePin") : t("posts.pin")}</Modal.Heading>
            <p className="text-sm text-muted">{t("posts.pinDescription")}</p>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4">
            <RadioGroup value={duration} onChange={(value) => setDuration(value as DurationKey)} variant="secondary">
              <Label>{t("posts.pinFor")}</Label>
              {durations.map((d) => (
                <Radio key={d.key} value={d.key}>
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    {t(d.keyName)}
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>

            {duration === "date" && (
              <DatePicker value={date} onChange={setDate} minValue={tomorrow} isRequired>
                <Label>{t("posts.pinUntil")}</Label>
                <DateField.Group fullWidth variant="secondary">
                  <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger aria-label={t("posts.openCalendar")}>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label={t("posts.pinUntil")}>
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>{(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}</Calendar.GridHeader>
                      <Calendar.GridBody>{(day) => <Calendar.Cell date={day} />}</Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>
            )}

            {error && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Huỷ
            </Button>
            <Button isPending={isLoading} isDisabled={duration === "date" && !date} onPress={() => void submit()}>
              {post.isPinned ? "Lưu" : "Ghim"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
