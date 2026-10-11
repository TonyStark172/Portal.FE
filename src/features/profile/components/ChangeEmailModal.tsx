"use client";

import { useState, type FormEvent } from "react";
import { useDispatch } from "react-redux";
import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  InputOTP,
  Label,
  Modal,
  REGEXP_ONLY_DIGITS,
  TextField,
  toast,
} from "@heroui/react";
import {
  portalApi,
  useConfirmEmailChangeMutation,
  useRequestEmailChangeMutation,
} from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, toFieldErrors } from "@/shared/api/problem";
import { useCountdown } from "../hooks/useCountdown";
import { useLocale } from "@/shared/i18n";

const CODE_LENGTH = 6;
const EMAIL_FORM_ID = "change-email-form";
const CODE_FORM_ID = "change-email-code-form";

type ChangeEmailModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current address, or nothing when the user is adding their first email. */
  currentEmail: string | null | undefined;
};

/**
 * Two steps: send a code to the new address, then enter it. The address is saved only once the code is
 * confirmed. Closing the modal discards the flow (its content unmounts).
 */
export function ChangeEmailModal({ isOpen, onOpenChange, currentEmail }: ChangeEmailModalProps) {
  const { t } = useLocale();
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger aria-label={t("common.close")} />
          <Modal.Header>
            <Modal.Heading>{currentEmail ? t("profile.changeEmail") : t("profile.addEmailTitle")}</Modal.Heading>
          </Modal.Header>
          <ChangeEmailFlow onDone={() => onOpenChange(false)} />
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ChangeEmailFlow({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const dispatch = useDispatch();
  const [requestCode, { isLoading: isSending }] = useRequestEmailChangeMutation();
  const [confirmCode, { isLoading: isConfirming }] = useConfirmEmailChangeMutation();
  const resend = useCountdown();

  const [email, setEmail] = useState("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string[]>>({});
  const [isCodeStep, setCodeStep] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  /** Sends (or re-sends) a code to `email`; returns whether it was sent. */
  async function sendCode(): Promise<boolean> {
    try {
      const sent = await requestCode({ requestEmailChangeCommand: { email: email.trim() } }).unwrap();
      resend.start(sent.resendAfterSeconds);
      return true;
    } catch (error) {
      const problem = toApiProblem(error);
      const message = problem.detail ?? "Không gửi được mã. Vui lòng thử lại.";
      if (isCodeStep) setCodeError(message);
      else setEmailErrors(problem.code === ErrorCodes.validationFailed ? toFieldErrors(problem) : { email: [message] });
      return false;
    }
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailErrors({});
    if (await sendCode()) setCodeStep(true);
  }

  async function handleResend() {
    setCode("");
    setCodeError(null);
    if (await sendCode()) toast.success(`Đã gửi lại mã tới ${email.trim()}`);
  }

  async function submitCode(value: string) {
    if (value.length !== CODE_LENGTH || isConfirming) return;
    setCodeError(null);

    try {
      await confirmCode({ confirmEmailChangeCommand: { code: value } }).unwrap();
      // The account menu shows the email from the signed-in user, which is cached separately from profiles.
      dispatch(portalApi.util.invalidateTags(["Auth"]));
      toast.success(t("profile.updateEmailSuccess"));
      onDone();
    } catch (error) {
      const problem = toApiProblem(error);
      setCode("");
      setCodeError(
        problem.code === ErrorCodes.validationFailed
          ? (Object.values(problem.errors ?? {})[0]?.[0] ?? "Mã xác thực không hợp lệ.")
          : (problem.detail ?? "Không xác nhận được mã. Vui lòng thử lại."),
      );
    }
  }

  if (!isCodeStep) {
    return (
      <>
        <Modal.Body>
          <Form id={EMAIL_FORM_ID} validationErrors={emailErrors} onSubmit={handleEmailSubmit}>
            <TextField name="email" type="email" isRequired autoFocus value={email} onChange={setEmail} variant="secondary">
              <Label>{t("profile.newEmail")}</Label>
              <Input placeholder="ten@congty.vn" autoComplete="email" />
              <Description>{t("profile.emailCodeDescription").replace("{count}", String(CODE_LENGTH))}</Description>
              <FieldError />
            </TextField>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close" variant="secondary">
            {t("profile.cancel")}
          </Button>
          <Button type="submit" form={EMAIL_FORM_ID} isPending={isSending}>
            {t("profile.sendCode")}
          </Button>
        </Modal.Footer>
      </>
    );
  }

  return (
    <>
      <Modal.Body>
        <Form
          id={CODE_FORM_ID}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCode(code);
          }}
        >
          <p className="text-sm text-muted">
            {t("profile.sentCode").replace("{email}", email.trim())}
          </p>
          <InputOTP
            aria-label={t("profile.verificationCode")}
            aria-describedby={codeError ? "change-email-code-error" : undefined}
            autoFocus
            maxLength={CODE_LENGTH}
            variant="secondary"
            pattern={REGEXP_ONLY_DIGITS}
            value={code}
            isInvalid={codeError !== null}
            onChange={(value) => {
              setCode(value);
              // InputOTP also reports the reset after a wrong code; only typing clears the error.
              if (value) setCodeError(null);
            }}
            onComplete={(value) => void submitCode(value)}
          >
            <InputOTP.Group>
              <InputOTP.Slot index={0} />
              <InputOTP.Slot index={1} />
              <InputOTP.Slot index={2} />
            </InputOTP.Group>
            <InputOTP.Separator />
            <InputOTP.Group>
              <InputOTP.Slot index={3} />
              <InputOTP.Slot index={4} />
              <InputOTP.Slot index={5} />
            </InputOTP.Group>
          </InputOTP>
          {codeError && (
            <p id="change-email-code-error" role="alert" className="text-sm text-danger">
              {codeError}
            </p>
          )}
          <div className="text-sm text-muted">
            {t("profile.noCode")} {" "}
            {resend.secondsLeft > 0 ? (
              <span>{t("profile.resendIn").replace("{seconds}", String(resend.secondsLeft))}</span>
            ) : (
              <Button size="sm" variant="ghost" isPending={isSending} onPress={handleResend}>
                {t("profile.resendCode")}
              </Button>
            )}
          </div>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onPress={() => {
            setCodeStep(false);
            setCode("");
            setCodeError(null);
          }}
        >
          {t("profile.back")}
        </Button>
        <Button type="submit" form={CODE_FORM_ID} isDisabled={code.length !== CODE_LENGTH} isPending={isConfirming}>
          {t("profile.confirm")}
        </Button>
      </Modal.Footer>
    </>
  );
}
