"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { Alert, Button, Card, FieldError, Form, Input, InputGroup, Label, Spinner, TextField } from "@heroui/react";
import { Eye, EyeSlash } from "@gravity-ui/icons";
import { ApiProblemError, ErrorCodes, toFieldErrors, type ApiProblem } from "@/shared/api/problem";
import { startSession } from "@/shared/session/sessionClient";
import { signedIn } from "@/shared/session/sessionSlice";
import { RETURN_URL_PARAM, safeReturnUrl } from "../lib/returnUrl";
import { useLocale } from "@/shared/i18n";

type FieldErrors = Record<string, string[]>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const { t } = useLocale();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const userName = String(form.get("userName") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const missing = requiredFieldErrors(userName, password, t);
    setProblem(null);
    setFieldErrors(missing);
    if (Object.keys(missing).length > 0) return;

    setIsSubmitting(true);
    try {
      dispatch(signedIn(await startSession({ userName, password })));
      router.replace(safeReturnUrl(searchParams.get(RETURN_URL_PARAM)));
    } catch (error) {
      const apiProblem = error instanceof ApiProblemError ? error.problem : null;
      setProblem(apiProblem);
      if (apiProblem) setFieldErrors(toFieldErrors(apiProblem));
      setIsSubmitting(false);
    }
  }

  const showAlert = problem !== null && problem.code !== ErrorCodes.validationFailed;

  return (
    <Card className="w-full max-w-sm">
      <Card.Header>
      <Card.Title>{t("common.login")}</Card.Title>
      </Card.Header>

      <Card.Content>
        {/* POST to its own page: a submit before hydration must never put the credentials in the URL. */}
        <Form className="flex flex-col gap-4" method="post" validationErrors={fieldErrors} onSubmit={handleSubmit}>
          {showAlert && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{problem.code === ErrorCodes.accountDisabled ? t("login.accountDisabled") : problem.code === ErrorCodes.accountLocked ? t("login.accountLocked") : t("login.error")}</Alert.Title>
                <Alert.Description>{problem.detail}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <TextField name="userName" autoComplete="username" autoFocus variant="secondary">
            <Label>{t("common.username")}</Label>
            <Input placeholder={t("common.usernamePlaceholder")} />
            <FieldError />
          </TextField>

          <TextField
            name="password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete="current-password"
            variant="secondary"
          >
            <Label>{t("common.password")}</Label>
            <InputGroup variant="secondary">
              <InputGroup.Input placeholder={t("common.passwordPlaceholder")} />
              <InputGroup.Suffix className="pr-1">
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  aria-label={isPasswordVisible ? t("common.hidePassword") : t("common.showPassword")}
                  onPress={() => setIsPasswordVisible((visible) => !visible)}
                >
                  {isPasswordVisible ? <EyeSlash /> : <Eye />}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldError />
          </TextField>

          <Button type="submit" fullWidth isPending={isSubmitting}>
            {isSubmitting && <Spinner color="current" size="sm" />}
            {t("common.login")}
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function requiredFieldErrors(userName: string, password: string, t: (key: string) => string): FieldErrors {
  const errors: FieldErrors = {};
  if (!userName) errors.userName = [t("login.usernameRequired")];
  if (!password) errors.password = [t("login.passwordRequired")];
  return errors;
}
