"use client";

import { DateField, DatePicker, FieldError, InputGroup, Label, TextField } from "@heroui/react";
import { Gift, Smartphone } from "@gravity-ui/icons";
import { getLocalTimeZone, parseDate, today, type DateValue } from "@internationalized/date";
import { MonthYearCalendar } from "@/shared/ui/MonthYearCalendar";
import { useLocale } from "@/shared/i18n";

const EARLIEST_DATE_OF_BIRTH = parseDate("1900-01-01");

/** What a self-edited profile field takes besides its value: required or not, and an error to show under it. */
type FieldState = {
  name: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  /** Shown under the field; without it the form's own validation errors for the field are shown. */
  errorMessage?: string;
  className?: string;
};

/** The phone number of one's own profile (the profile form, onboarding). */
export function PhoneNumberField({
  name,
  defaultValue,
  onChange,
  isRequired,
  isInvalid,
  errorMessage,
}: FieldState & { defaultValue?: string; onChange?: (value: string) => void }) {
  const { t } = useLocale();
  return (
    <TextField
      name={name}
      type="tel"
      defaultValue={defaultValue}
      onChange={onChange}
      isRequired={isRequired}
      isInvalid={isInvalid}
    >
      <Label>{t("profile.phone")}</Label>
      <InputGroup variant="secondary">
        <InputGroup.Prefix>
          <Smartphone className="size-4 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input placeholder="0912 345 678" autoComplete="tel" />
      </InputGroup>
      <FieldError>{errorMessage}</FieldError>
    </TextField>
  );
}

/** The date of birth of one's own profile: typed, or picked from a month/year calendar, from 1900 up to today. */
export function BirthDateField({
  name,
  value,
  onChange,
  isRequired,
  isInvalid,
  errorMessage,
  className,
}: FieldState & { value: DateValue | null; onChange: (value: DateValue | null) => void }) {
  const { t } = useLocale();
  return (
    <DatePicker
      name={name}
      value={value}
      onChange={onChange}
      minValue={EARLIEST_DATE_OF_BIRTH}
      maxValue={today(getLocalTimeZone())}
      isRequired={isRequired}
      isInvalid={isInvalid}
      className={className}
    >
      <Label>{t("profile.birthDate")}</Label>
      <DateField.Group fullWidth variant="secondary">
        <DateField.Prefix>
          <Gift className="size-4 text-muted" />
        </DateField.Prefix>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger aria-label={t("profile.openCalendar")}>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <FieldError>{errorMessage}</FieldError>
      <DatePicker.Popover>
        <MonthYearCalendar
          label={t("profile.birthDate")}
          anchor={value ?? today(getLocalTimeZone())}
          minValue={EARLIEST_DATE_OF_BIRTH}
          maxValue={today(getLocalTimeZone())}
        />
      </DatePicker.Popover>
    </DatePicker>
  );
}
