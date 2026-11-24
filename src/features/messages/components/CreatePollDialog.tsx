"use client";

import { useRef, useState } from "react";
import { Button, Input, Label, Modal, Switch, TextField, toast } from "@heroui/react";
import { Plus, Xmark } from "@gravity-ui/icons";
import { MeetingDateField } from "@/features/meetings/components/MeetingDateField";
import { MeetingSelect } from "@/features/meetings/components/MeetingRecurrenceEditor";
import { useCreateChatPollMutation, type ChatMessageDto } from "@/shared/api/generated/portalApi";
import { toApiProblem } from "@/shared/api/problem";
import { useLocale } from "@/shared/i18n";
import { MAX_POLL_DURATION_MS, MIN_POLL_DURATION_MS, POLL_DURATIONS, toLocalDateTime } from "../lib/pollTime";

/** The same limits as Portal.BE's ConversationRules. */
export const MAX_POLL_QUESTION_LENGTH = 200;
export const MAX_POLL_OPTION_LENGTH = 100;
const MAX_OPTIONS_AT_CREATION = 10;

type Option = { key: number; text: string };

/** The options worth sending: written ones, trimmed. */
const written = (options: Option[]) => options.map((option) => option.text.trim()).filter(Boolean);

/** One of the durations, or a date and time picked ("Other"). */
type Deadline = (typeof POLL_DURATIONS)[number]["id"] | "custom";

/** Whether a picked date and time (local) is 5 minutes to 30 days away. */
const inRange = (local: string, now: number) => {
  const left = new Date(local).getTime() - now;
  return left >= MIN_POLL_DURATION_MS && left <= MAX_POLL_DURATION_MS;
};

/**
 * Asks a poll in a conversation, as on Messenger: a question, two to ten options (more can be added as it goes), and
 * whether people may pick several and add options themselves.
 */
export function CreatePollDialog({ conversationId, isOpen, onClose, onCreated }: {
  conversationId: number;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (message: ChatMessageDto) => void;
}) {
  const { t } = useLocale();
  const nextKey = useRef(2);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Option[]>([{ key: 0, text: "" }, { key: 1, text: "" }]);
  const [multiple, setMultiple] = useState(true);
  const [newOptions, setNewOptions] = useState(true);
  // No deadline unless asked for; then a day, unless another duration or a date and time is chosen.
  const [limited, setLimited] = useState(false);
  const [deadline, setDeadline] = useState<Deadline>("1d");
  // A picked date and time (local, as the field reads it), checked against the clock whenever it changes.
  const [custom, setCustom] = useState({ value: "", minDate: "", valid: true });
  const [create, { isLoading }] = useCreateChatPollMutation();

  const texts = written(options);
  const duplicate = new Set(texts.map((text) => text.toLocaleLowerCase())).size !== texts.length;
  const pickingDate = limited && deadline === "custom";
  const ready = question.trim() !== "" && texts.length >= 2 && !duplicate && (!pickingDate || custom.valid);

  function reset() {
    setQuestion("");
    setOptions([{ key: 0, text: "" }, { key: 1, text: "" }]);
    setMultiple(true);
    setNewOptions(true);
    setLimited(false);
    setDeadline("1d");
  }

  function chooseDeadline(value: Deadline) {
    setDeadline(value);
    if (value === "custom") {
      // Tomorrow at the next full hour, to start from.
      const start = new Date(Date.now() + 24 * 3_600_000);
      start.setMinutes(0, 0, 0);
      start.setHours(start.getHours() + 1);
      setCustom({ value: toLocalDateTime(start), minDate: toLocalDateTime(new Date()).slice(0, 10), valid: true });
    }
  }

  /** When the poll ends, from now: computed as it is sent. */
  function endsAt(): string | null {
    if (!limited) return null;
    if (deadline === "custom") return new Date(custom.value).toISOString();
    return new Date(Date.now() + POLL_DURATIONS.find((d) => d.id === deadline)!.ms).toISOString();
  }

  async function submit() {
    if (pickingDate && !inRange(custom.value, Date.now())) {
      setCustom((current) => ({ ...current, valid: false }));
      return;
    }
    try {
      const message = await create({
        id: conversationId,
        createChatPollCommand: {
          question: question.trim(),
          options: texts,
          allowsMultipleChoices: multiple,
          allowsNewOptions: newOptions,
          endsAt: endsAt(),
        },
      }).unwrap();
      onCreated(message);
      reset();
      onClose();
    } catch (failure) {
      toast.danger(toApiProblem(failure).detail ?? t("common.genericError"));
    }
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="md" placement="center" scroll="inside">
        <Modal.Dialog className="max-h-[min(44rem,calc(100dvh-2rem))]">
          <Modal.CloseTrigger aria-label={t("messages.close")} />
          <Modal.Header><Modal.Heading>{t("messages.poll.create")}</Modal.Heading></Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <TextField autoFocus value={question} onChange={setQuestion} maxLength={MAX_POLL_QUESTION_LENGTH} variant="secondary">
              <Label>{t("messages.poll.question")}</Label>
              <Input placeholder={t("messages.poll.questionPlaceholder")} />
            </TextField>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t("messages.poll.options")}</legend>
              {options.map((option, index) => (
                <div key={option.key} className="flex items-center gap-1">
                  <TextField
                    aria-label={t("messages.poll.optionLabel").replace("{n}", String(index + 1))}
                    value={option.text}
                    onChange={(text) => setOptions((current) => current.map((o) => (o.key === option.key ? { ...o, text } : o)))}
                    maxLength={MAX_POLL_OPTION_LENGTH}
                    variant="secondary"
                    className="flex-1"
                  >
                    <Input placeholder={t("messages.poll.optionPlaceholder").replace("{n}", String(index + 1))} />
                  </TextField>
                  {options.length > 2 && (
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={t("messages.poll.removeOption").replace("{n}", String(index + 1))}
                      onPress={() => setOptions((current) => current.filter((o) => o.key !== option.key))}
                    >
                      <Xmark className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              {duplicate && <p className="text-xs text-danger">{t("messages.poll.duplicate")}</p>}
              {options.length < MAX_OPTIONS_AT_CREATION && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="self-start"
                  onPress={() => setOptions((current) => [...current, { key: nextKey.current++, text: "" }])}
                >
                  <Plus className="size-4" /> {t("messages.poll.addOption")}
                </Button>
              )}
            </fieldset>

            <div className="flex flex-col gap-3 border-t border-separator pt-3">
              <Switch size="sm" isSelected={multiple} onChange={setMultiple}>
                <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>{t("messages.poll.allowMultiple")}</Label></Switch.Content>
              </Switch>
              <Switch size="sm" isSelected={newOptions} onChange={setNewOptions}>
                <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>{t("messages.poll.allowNewOptions")}</Label></Switch.Content>
              </Switch>
              <Switch size="sm" isSelected={limited} onChange={setLimited}>
                <Switch.Content><Switch.Control><Switch.Thumb /></Switch.Control><Label>{t("messages.poll.limitTime")}</Label></Switch.Content>
              </Switch>
              {limited && (
                <div className="flex flex-col gap-3 ps-11">
                  <MeetingSelect
                    label={t("messages.poll.deadline")}
                    value={deadline}
                    onChange={(value) => chooseDeadline(value as Deadline)}
                    options={[
                      ...POLL_DURATIONS.map((d): [string, string] => [d.id, t(d.label)]),
                      ["custom", t("messages.poll.duration.custom")],
                    ]}
                  />
                  {deadline === "custom" && (
                    <MeetingDateField
                      label={t("messages.poll.endsAtLabel")}
                      value={custom.value}
                      minDate={custom.minDate}
                      onChange={(value) => setCustom((current) => ({ ...current, value, valid: value !== "" && inRange(value, Date.now()) }))}
                      error={custom.valid ? undefined : t("messages.poll.deadlineRange")}
                    />
                  )}
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>{t("messages.cancel")}</Button>
            <Button isDisabled={!ready} isPending={isLoading} onPress={() => void submit()}>{t("messages.poll.submit")}</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
