"use client";

import { useEffect, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, FieldError, Form, Label, ListBox, Select, Separator, Spinner } from "@heroui/react";
import { Calendar, Camera, Comments, Lock, PersonPencil } from "@gravity-ui/icons";
import { parseDate, type DateValue } from "@internationalized/date";
import { useAppDispatch } from "@/core/hooks";
import { useCurrentUser, useLogout } from "@/features/auth";
import { BirthDateField, HometownField, NO_HOMETOWN, PhoneNumberField, useAvatarPicker, useUploadMyAvatarMutation } from "@/features/profile";
import {
  portalApi,
  useCompleteOnboardingMutation,
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
  type Gender,
  type ProfileDto,
  type UpdateMyProfileCommand,
  type UserAssignmentDto,
} from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, toFieldErrors, type ApiProblem } from "@/shared/api/problem";
import { useProtectedImage } from "@/shared/api/useProtectedImage";
import { useLocale } from "@/shared/i18n";
import { UserAvatar } from "@/shared/ui/UserAvatar";

const FORM_ID = "onboarding-profile-form";
const STEPS = 2;
const GENDERS: { id: NonNullable<Gender>; label: string }[] = [
  { id: "Male", label: "dashboard.male" },
  { id: "Female", label: "dashboard.female" },
];

type Step = 1 | 2;
type FieldErrors = Record<string, string[]>;

/**
 * The welcome a new account goes through before using the portal, outside the app shell. Step 1 asks for the profile
 * details the organization needs (phone number, date of birth and gender are required; hometown and a photo are
 * optional) beside the ones an administrator owns; step 2 sums up and ends onboarding. There is no skipping it: the
 * only other way out is signing out.
 */
export function OnboardingFlow() {
  const { t } = useLocale();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const logout = useLogout();
  const { user } = useCurrentUser();
  const profileQuery = useGetMyProfileQuery();
  const profile = profileQuery.data;
  const [updateProfile, { isLoading: isUpdating }] = useUpdateMyProfileMutation();
  const [uploadAvatar, { isLoading: isUploading }] = useUploadMyAvatarMutation();
  const [completeOnboarding, { isLoading: isFinishing }] = useCompleteOnboardingMutation();
  const [isLeaving, setLeaving] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<{ title: string; detail: string } | null>(null);
  // Edited before the profile is known: the profile's own values until the user changes them.
  const [dateOfBirth, setDateOfBirth] = useState<DateValue | null | undefined>(undefined);
  const [gender, setGender] = useState<Gender | undefined>(undefined);
  // A fitted picture waiting to be uploaded on "Tiếp tục", and the preview shown for it (kept once uploaded).
  const [pendingAvatar, setPendingAvatar] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const savedAvatar = useProtectedImage(avatarPreview ? null : profile?.avatarUrl);
  const avatarSrc = avatarPreview ?? savedAvatar;
  const picker = useAvatarPicker((avatar) => {
    setPendingAvatar(avatar);
    setAvatarPreview(URL.createObjectURL(avatar));
  });

  // A preview is freed once replaced, or when the page goes.
  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  const birthDate = dateOfBirth !== undefined ? dateOfBirth : profile?.dateOfBirth ? parseDate(profile.dateOfBirth) : null;
  const chosenGender = gender !== undefined ? gender : (profile?.gender ?? null);

  const clearError = (field: string) =>
    setFieldErrors((current) => {
      if (!(field in current)) return current;
      const rest = { ...current };
      delete rest[field];
      return rest;
    });

  function showProblem(title: string, apiProblem: ApiProblem) {
    setProblem({ title, detail: apiProblem.detail ?? t("common.genericError") });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const hometown = text("hometown");
    const command: UpdateMyProfileCommand = {
      phoneNumber: text("phoneNumber"),
      dateOfBirth: birthDate?.toString() ?? null,
      gender: chosenGender,
      hometown: hometown === NO_HOMETOWN ? null : hometown,
    };

    const missing: FieldErrors = {};
    if (!command.phoneNumber) missing.phoneNumber = [t("onboarding.phoneRequired")];
    if (!command.dateOfBirth) missing.dateOfBirth = [t("onboarding.birthDateRequired")];
    if (!command.gender) missing.gender = [t("onboarding.genderRequired")];
    setFieldErrors(missing);
    setProblem(null);
    if (Object.keys(missing).length > 0) return;

    try {
      if (isChanged(profile, command)) await updateProfile({ updateMyProfileCommand: command }).unwrap();
      if (pendingAvatar) {
        await uploadAvatar(new File([pendingAvatar], "avatar.jpg", { type: "image/jpeg" })).unwrap();
        setPendingAvatar(null);
      }
    } catch (error) {
      const apiProblem = toApiProblem(error);
      if (apiProblem.code === ErrorCodes.validationFailed && apiProblem.errors) setFieldErrors(toFieldErrors(apiProblem));
      else showProblem(t("onboarding.saveError"), apiProblem);
      return;
    }
    setStep(2);
  }

  async function finish() {
    setProblem(null);
    try {
      await completeOnboarding().unwrap();
    } catch (error) {
      const apiProblem = toApiProblem(error);
      if (apiProblem.code === ErrorCodes.validationFailed && apiProblem.errors) {
        // Something required is missing after all: back to where it is filled in.
        setFieldErrors(toFieldErrors(apiProblem));
        setStep(1);
      } else {
        showProblem(t("onboarding.finishError"), apiProblem);
        // A temporary password comes first: reloading the user lets the gate send them to change it.
        if (apiProblem.code === ErrorCodes.passwordChangeRequired) dispatch(portalApi.util.invalidateTags(["Auth"]));
      }
      return;
    }
    setLeaving(true);
    // Cleared at once so the portal does not send the user straight back here before the reload lands.
    dispatch(
      portalApi.util.updateQueryData("getCurrentUser", undefined, (draft) => {
        draft.user.needsOnboarding = false;
      }),
    );
    dispatch(portalApi.util.invalidateTags(["Auth"]));
    router.replace("/");
  }

  const isSaving = isUpdating || isUploading;
  const fullName = profile?.fullName ?? user?.fullName ?? "";
  const assignments = profile?.assignments ?? user?.assignments ?? [];

  return (
    <div className="flex min-h-dvh w-full md:items-center md:justify-center md:p-6">
      <Card
        data-onboarding-card
        className="flex min-h-dvh w-full flex-col gap-0 rounded-none p-0 shadow-none md:grid md:min-h-[36rem] md:max-w-5xl md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-[1fr_auto] md:overflow-hidden md:rounded-3xl md:shadow-[var(--surface-shadow)]"
      >
        {/* The left panel is two cells (title, then the actions) so a phone can put the form between them. */}
        <header className="flex flex-col gap-2 bg-surface-secondary px-4 pt-6 pb-5 md:col-start-1 md:row-start-1 md:px-10 md:pt-10">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("onboarding.label")}</p>
          <h1 className="text-2xl font-semibold text-foreground md:text-3xl">
            {t(step === 1 ? "onboarding.profileTitle" : "onboarding.readyTitle")}
          </h1>
          <p className="text-sm text-muted">{t(step === 1 ? "onboarding.profileSubtitle" : "onboarding.readySubtitle")}</p>
        </header>

        <section className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:col-start-2 md:row-span-2 md:row-start-1 md:p-10">
          {problem && (
            <Alert status="danger" role="alert">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{problem.title}</Alert.Title>
                <Alert.Description>{problem.detail}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          {profileQuery.isError && !profile ? (
            <Alert status="danger" role="alert">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{t("profile.loadError")}</Alert.Description>
              </Alert.Content>
              <Button size="sm" variant="secondary" onPress={() => void profileQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </Alert>
          ) : !profile ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner aria-label={t("onboarding.loading")} />
            </div>
          ) : (
            <>
              {/* Kept mounted on step 2, so "Quay lại" finds what was entered. */}
              <Form
                id={FORM_ID}
                hidden={step !== 1}
                className="flex flex-col gap-6"
                validationBehavior="aria"
                validationErrors={fieldErrors.hometown ? { hometown: fieldErrors.hometown } : undefined}
                onSubmit={saveProfile}
              >
                <div className="flex items-start gap-4">
                  <AvatarDrop fullName={fullName} src={avatarSrc} onOpen={picker.open} onDropFile={picker.pickFile} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-lg font-semibold text-foreground">{fullName}</p>
                    {profile.email && <p className="text-sm break-all text-muted">{profile.email}</p>}
                    <p className="text-sm text-muted">
                      {[profile.employeeCode, ...primaryPlace(assignments)].filter(Boolean).join(" · ")}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted">
                      <Lock aria-hidden className="size-3" />
                      {t("onboarding.managedByAdmin")}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div data-onboarding-field="phoneNumber">
                    <PhoneNumberField
                      name="phoneNumber"
                      defaultValue={profile.phoneNumber ?? ""}
                      onChange={() => clearError("phoneNumber")}
                      isRequired
                      isInvalid={"phoneNumber" in fieldErrors}
                      errorMessage={fieldErrors.phoneNumber?.join(" ")}
                    />
                  </div>
                  <div data-onboarding-field="dateOfBirth">
                    <BirthDateField
                      className="w-full"
                      name="dateOfBirth"
                      value={birthDate}
                      onChange={(value) => {
                        setDateOfBirth(value);
                        clearError("dateOfBirth");
                      }}
                      isRequired
                      isInvalid={"dateOfBirth" in fieldErrors}
                      errorMessage={fieldErrors.dateOfBirth?.join(" ")}
                    />
                  </div>
                  <Select
                    fullWidth
                    variant="secondary"
                    isRequired
                    placeholder={t("onboarding.genderPlaceholder")}
                    selectedKey={chosenGender}
                    onSelectionChange={(key) => {
                      setGender((key as Gender) ?? null);
                      clearError("gender");
                    }}
                    isInvalid={"gender" in fieldErrors}
                  >
                    <Label>{t("profile.gender")}</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {GENDERS.map((option) => (
                          <ListBox.Item id={option.id} key={option.id} textValue={t(option.label)}>
                            {t(option.label)}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                    <FieldError>{fieldErrors.gender?.join(" ")}</FieldError>
                  </Select>
                  <HometownField name="hometown" defaultValue={profile.hometown} />
                </div>
              </Form>

              {step === 2 && <Summary fullName={fullName} avatarSrc={avatarSrc} assignments={assignments} />}
            </>
          )}
        </section>

        <footer className="sticky bottom-0 flex flex-col gap-4 border-t border-separator bg-surface-secondary px-4 py-4 md:static md:col-start-1 md:row-start-2 md:border-0 md:px-10 md:pb-10">
          {step === 1 ? (
            <Button type="submit" form={FORM_ID} fullWidth isPending={isSaving} isDisabled={!profile}>
              {t("onboarding.continue")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" isDisabled={isFinishing || isLeaving} onPress={() => setStep(1)}>
                {t("onboarding.back")}
              </Button>
              <Button className="flex-1" isPending={isFinishing || isLeaving} onPress={() => void finish()}>
                {t("onboarding.start")}
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <StepDots step={step} />
            {/* Outside the app shell there is no account menu: this is the only other way out. */}
            <Button size="sm" variant="ghost" className="text-muted" onPress={() => void logout()}>
              {t("common.logout")}
            </Button>
          </div>
        </footer>
      </Card>

      {picker.elements}
    </div>
  );
}

/** Whether saving would change the profile (every field is sent: the profile is replaced as a whole). */
function isChanged(profile: ProfileDto, command: UpdateMyProfileCommand) {
  return (
    command.phoneNumber !== (profile.phoneNumber ?? null) ||
    command.dateOfBirth !== (profile.dateOfBirth ?? null) ||
    command.gender !== (profile.gender ?? null) ||
    command.hometown !== (profile.hometown ?? null)
  );
}

/** The primary department and position, in that order (either may be missing). */
function primaryPlace(assignments: UserAssignmentDto[]) {
  const primary = assignments.find((a) => a.isPrimary) ?? assignments[0];
  return primary ? [primary.departmentName, primary.positionName] : [];
}

/** The avatar to pick on step 1: pressed for the file dialog, or a picture dropped on it; either goes to the cropper. */
function AvatarDrop({ fullName, src, onOpen, onDropFile }: {
  fullName: string;
  src: string | undefined;
  onOpen: () => void;
  onDropFile: (file: File) => void;
}) {
  const { t } = useLocale();
  const [isOver, setOver] = useState(false);

  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file) onDropFile(file);
  }

  return (
    <div className="flex w-24 shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        aria-label={t("onboarding.pickAvatar")}
        onClick={onOpen}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        data-over={isOver || undefined}
        className="group relative size-24 cursor-pointer overflow-hidden rounded-2xl border border-dashed border-border bg-default outline-none focus-visible:ring-2 focus-visible:ring-focus data-[over]:border-accent data-[over]:bg-accent-soft"
      >
        {src ? (
          <UserAvatar fullName={fullName} src={src} className="size-full rounded-none" />
        ) : (
          <span className="flex size-full items-center justify-center text-muted">
            <Camera aria-hidden className="size-6" />
          </span>
        )}
        {src && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera aria-hidden className="size-5" />
          </span>
        )}
      </button>
      <span className="text-center text-[11px] leading-tight text-muted">{t("onboarding.avatarHint")}</span>
    </div>
  );
}

/** Step 2: who the user is in the organization, and where to start. */
function Summary({ fullName, avatarSrc, assignments }: {
  fullName: string;
  avatarSrc: string | undefined;
  assignments: UserAssignmentDto[];
}) {
  const { t } = useLocale();
  const next = [
    { icon: Comments, text: t("onboarding.nextFeed") },
    { icon: Calendar, text: t("onboarding.nextMeetings") },
    { icon: PersonPencil, text: t("onboarding.nextProfile") },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <UserAvatar fullName={fullName} src={avatarSrc} className="size-16 shrink-0 rounded-2xl text-xl" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-lg font-semibold text-foreground">{fullName}</p>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted">{t("onboarding.noDepartment")}</p>
          ) : (
            assignments.map((a) => (
              <p key={a.departmentId} className="text-sm text-muted">
                {[a.positionName, a.departmentName].filter(Boolean).join(" · ")}
              </p>
            ))
          )}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">{t("onboarding.nextSteps")}</h2>
        <ul className="flex flex-col gap-3">
          {next.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm text-foreground">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-default text-muted">
                <Icon aria-hidden className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Where the user is: the current step a short pill, the others dots. */
function StepDots({ step }: { step: Step }) {
  const { t } = useLocale();
  return (
    <div className="flex items-center gap-1.5">
      <span className="sr-only">{t("onboarding.step").replace("{step}", String(step)).replace("{count}", String(STEPS))}</span>
      {Array.from({ length: STEPS }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-2 rounded-full transition-all ${i + 1 === step ? "w-6 bg-accent" : "w-2 bg-foreground/20"}`}
        />
      ))}
    </div>
  );
}
