"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, FieldError, Form, Input, Label, TextField } from "@heroui/react";
import { useAppDispatch } from "@/core/hooks";
import { portalApi, useChangePasswordMutation } from "@/shared/api/generated/portalApi";
import { ErrorCodes, toApiProblem, toFieldErrors } from "@/shared/api/problem";
import { startSession } from "@/shared/session/sessionClient";
import { signedIn } from "@/shared/session/sessionSlice";
import { useLocale } from "@/shared/i18n";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

type FieldErrors = Record<string, string[]>;

/** The password rules of the backend (StrongPassword): 8 characters at least, a letter and a digit. */
const isStrong = (password: string) => password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password);

/**
 * Choosing one's own password in place of a temporary one (or any time). Changing it signs out every device, this one
 * included, so the form signs in again with the new password before opening the home page.
 */
export function ChangePasswordForm() {
  const { t } = useLocale();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const logout = useLogout();
  const { user, isError: isUserError, refetch: refetchUser } = useCurrentUser();
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [isSigningIn, setIsSigningIn] = useState(false);
  /** The password is changed but signing in with it failed: the only way on is to sign out and in again. */
  const [mustSignInAgain, setMustSignInAgain] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!isStrong(next)) found.newPassword = [t("auth.passwordRules")];
    if (next !== again) found.confirm = [t("auth.passwordsDiffer")];
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    try {
      await changePassword({ changePasswordCommand: { currentPassword: current, newPassword: next } }).unwrap();
    } catch (error) {
      const problem = toApiProblem(error);
      if (problem.code === ErrorCodes.validationFailed) setErrors(toFieldErrors(problem));
      else setFailure(problem.detail ?? t("common.genericError"));
      return;
    }

    // The password is changed and every refresh token revoked: sign in again with the new one.
    setIsSigningIn(true);
    try {
      dispatch(signedIn(await startSession({ userName: user?.userName ?? "", password: next })));
    } catch {
      // Not signed out here: that would unmount this form (RequireAuth) and hide the message. The user chooses to.
      setMustSignInAgain(true);
      setIsSigningIn(false);
      return;
    }
    // The cached user still says "must change password" and `changePassword` only marks it stale: until the refetch
    // lands, the portal's RequireAuth would send the user straight back here. So clear the flag before navigating.
    dispatch(
      portalApi.util.updateQueryData("getCurrentUser", undefined, (draft) => {
        draft.user.mustChangePassword = false;
      }),
    );
    router.replace("/");
  }

  return (
    <Card className="w-full max-w-sm">
      <Card.Header>
        <Card.Title>{t("auth.changePasswordTitle")}</Card.Title>
        <Card.Description>{t("auth.changePasswordHint")}</Card.Description>
      </Card.Header>
      <Card.Content>
        <Form className="flex flex-col gap-4" method="post" onSubmit={submit} validationErrors={errors}>
          {isUserError && !user && (
            <Alert status="danger" role="alert">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{t("profile.loadError")}</Alert.Description>
              </Alert.Content>
              <Button size="sm" variant="secondary" onPress={() => void refetchUser()}>
                {t("common.retry")}
              </Button>
            </Alert>
          )}
          {mustSignInAgain && (
            <Alert status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{t("auth.passwordChangedSignInAgain")}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          {failure && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{failure}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <TextField name="currentPassword" type="password" isRequired autoFocus variant="secondary" value={current} onChange={setCurrent}>
            <Label>{t("auth.currentPassword")}</Label>
            <Input autoComplete="current-password" />
            <FieldError />
          </TextField>
          <TextField name="newPassword" type="password" isRequired variant="secondary" value={next} onChange={setNext}>
            <Label>{t("auth.newPassword")}</Label>
            <Input autoComplete="new-password" />
            <FieldError />
          </TextField>
          <TextField name="confirm" type="password" isRequired variant="secondary" value={again} onChange={setAgain}>
            <Label>{t("auth.confirmPassword")}</Label>
            <Input autoComplete="new-password" />
            <FieldError />
          </TextField>
          <Button type="submit" fullWidth isPending={isLoading || isSigningIn} isDisabled={!user || mustSignInAgain}>
            {t("auth.changePasswordSubmit")}
          </Button>
          {/* Always offered: this page is outside the app shell, so there is no user menu to sign out from. */}
          <Button fullWidth variant="secondary" onPress={() => void logout()}>
            {t("common.logout")}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}
