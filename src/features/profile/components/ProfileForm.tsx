"use client";

import { useState, type FormEvent } from "react";
import {
  Alert,
  Button,
  Calendar,
  DateField,
  DatePicker,
  Drawer,
  FieldError,
  Form,
  InputGroup,
  Label,
  Radio,
  RadioGroup,
  Separator,
  TextField,
  toast,
} from "@heroui/react";
import { Envelope, Gift, Smartphone } from "@gravity-ui/icons";
import { getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { useUpdateMyProfileMutation, type Gender, type ProfileDto } from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, toFieldErrors, type ApiProblem } from "@/shared/api/problem";
import { AvatarEditor } from "./AvatarEditor";
import { ChangeEmailModal } from "./ChangeEmailModal";
import { HometownField, NO_HOMETOWN } from "./HometownField";
import { InfoList, InfoRow } from "./InfoRow";
import { EmailValue, genderLabels, ProfileSection } from "./ProfileDetails";

const FORM_ID = "profile-form";
const EARLIEST_DATE_OF_BIRTH = parseDate("1900-01-01");

/** "Not stated" is a radio too, so a gender once chosen can be cleared again. */
const GENDER_OPTIONS = [...Object.entries(genderLabels), ["", "Không nêu"]] as const;

/** Edit mode of the profile drawer: renders the drawer's body and footer. */
export function ProfileForm({ profile, onDone }: { profile: ProfileDto; onDone: () => void }) {
  const [update, { isLoading: isSaving }] = useUpdateMyProfileMutation();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [isEmailOpen, setEmailOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const hometown = text("hometown");

    setFieldErrors({});
    setProblem(null);
    try {
      await update({
        updateMyProfileCommand: {
          phoneNumber: text("phoneNumber"),
          dateOfBirth: text("dateOfBirth"),
          gender: text("gender") as Gender,
          hometown: hometown === NO_HOMETOWN ? null : hometown,
        },
      }).unwrap();
      toast.success("Đã lưu hồ sơ");
      onDone();
    } catch (error) {
      const apiProblem = toApiProblem(error);
      if (apiProblem.code === ErrorCodes.validationFailed) setFieldErrors(toFieldErrors(apiProblem));
      else setProblem(apiProblem);
    }
  }

  return (
    <>
      <Drawer.Body className="flex flex-col gap-4 text-foreground">
        <AvatarEditor profile={profile} />

        <Separator />

        <ProfileSection title="Email">
          <InfoList>
            <InfoRow
              icon={<Envelope />}
              label="Email"
              value={profile.email && <EmailValue email={profile.email} isConfirmed={profile.emailConfirmed} />}
              action={
                <Button size="sm" variant="secondary" onPress={() => setEmailOpen(true)}>
                  {profile.email ? "Đổi" : "Thêm email"}
                </Button>
              }
            />
          </InfoList>
        </ProfileSection>

        <Separator />

        <ProfileSection title="Thông tin cá nhân">
          <Form id={FORM_ID} className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={handleSubmit}>
            {problem && (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Không lưu được hồ sơ</Alert.Title>
                  <Alert.Description>{problem.detail}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            <TextField name="phoneNumber" type="tel" defaultValue={profile.phoneNumber ?? ""}>
              <Label>Số điện thoại</Label>
              <InputGroup variant="secondary">
                <InputGroup.Prefix>
                  <Smartphone className="size-4 text-muted" />
                </InputGroup.Prefix>
                <InputGroup.Input placeholder="vd: 0912 345 678" autoComplete="tel" />
              </InputGroup>
              <FieldError />
            </TextField>

            <DatePicker
              name="dateOfBirth"
              defaultValue={profile.dateOfBirth ? parseDate(profile.dateOfBirth) : null}
              minValue={EARLIEST_DATE_OF_BIRTH}
              maxValue={today(getLocalTimeZone())}
            >
              <Label>Ngày sinh</Label>
              <DateField.Group fullWidth variant="secondary">
                <DateField.Prefix>
                  <Gift className="size-4 text-muted" />
                </DateField.Prefix>
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix>
                  <DatePicker.Trigger aria-label="Mở lịch">
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                </DateField.Suffix>
              </DateField.Group>
              <FieldError />
              <DatePicker.Popover>
                <Calendar aria-label="Ngày sinh">
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
                    <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                  </Calendar.Grid>
                  <Calendar.YearPickerGrid>
                    <Calendar.YearPickerGridBody>
                      {({ year }) => <Calendar.YearPickerCell year={year} />}
                    </Calendar.YearPickerGridBody>
                  </Calendar.YearPickerGrid>
                </Calendar>
              </DatePicker.Popover>
            </DatePicker>

            <RadioGroup name="gender" defaultValue={profile.gender ?? ""} variant="secondary">
              <Label>Giới tính</Label>
              {/* The label stays above; only the options sit in a row. */}
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {GENDER_OPTIONS.map(([value, label]) => (
                  <Radio key={value} value={value}>
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      {label}
                    </Radio.Content>
                  </Radio>
                ))}
              </div>
              <FieldError />
            </RadioGroup>

            <HometownField name="hometown" defaultValue={profile.hometown} />
          </Form>
        </ProfileSection>
      </Drawer.Body>

      <Drawer.Footer className="justify-end gap-2">
        <Button variant="secondary" onPress={onDone}>
          Huỷ
        </Button>
        <Button type="submit" form={FORM_ID} isPending={isSaving}>
          Lưu
        </Button>
      </Drawer.Footer>

      <ChangeEmailModal isOpen={isEmailOpen} onOpenChange={setEmailOpen} currentEmail={profile.email} />
    </>
  );
}
