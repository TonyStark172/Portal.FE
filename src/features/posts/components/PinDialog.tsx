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

const DAY = 24 * 60 * 60 * 1000;

const durations = [
  { key: "1d", label: "1 ngày", days: 1 },
  { key: "3d", label: "3 ngày", days: 3 },
  { key: "7d", label: "1 tuần", days: 7 },
  { key: "30d", label: "1 tháng", days: 30 },
  { key: "forever", label: "Không thời hạn", days: null },
  { key: "date", label: "Đến hết ngày…", days: null },
] as const;

type DurationKey = (typeof durations)[number]["key"];

type PinDialogProps = {
  post: PostDto;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Pins a post to the top of the feed for a chosen time, or changes when an existing pin ends. */
export function PinDialog({ post, isOpen, onOpenChange }: PinDialogProps) {
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
      toast.success(post.isPinned ? "Đã đổi thời hạn ghim" : "Đã ghim bài viết");
      onOpenChange(false);
    } catch (problem) {
      setError(toApiProblem(problem).detail ?? "Không ghim được bài viết.");
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label="Đóng" />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Pin className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{post.isPinned ? "Đổi thời hạn ghim" : "Ghim bài viết"}</Modal.Heading>
            <p className="text-sm text-muted">Bài được ghim nằm trên cùng bảng tin của mọi người. Tối đa 3 bài cùng lúc.</p>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-4">
            <RadioGroup value={duration} onChange={(value) => setDuration(value as DurationKey)} variant="secondary">
              <Label>Ghim trong</Label>
              {durations.map((d) => (
                <Radio key={d.key} value={d.key}>
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    {d.label}
                  </Radio.Content>
                </Radio>
              ))}
            </RadioGroup>

            {duration === "date" && (
              <DatePicker value={date} onChange={setDate} minValue={tomorrow} isRequired>
                <Label>Ghim đến hết ngày</Label>
                <DateField.Group fullWidth variant="secondary">
                  <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger aria-label="Mở lịch">
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label="Ghim đến hết ngày">
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
