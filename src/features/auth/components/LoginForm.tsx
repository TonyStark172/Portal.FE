"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { Alert, Button, Card, FieldError, Form, Input, Label, Spinner, TextField } from "@heroui/react";
import { ApiProblemError, ErrorCodes, toFieldErrors, type ApiProblem } from "@/shared/api/problem";
import { startSession } from "@/shared/session/sessionClient";
import { signedIn } from "@/shared/session/sessionSlice";
import { RETURN_URL_PARAM, safeReturnUrl } from "../lib/returnUrl";

type FieldErrors = Record<string, string[]>;

const ALERT_TITLES: Record<string, string> = {
  [ErrorCodes.accountDisabled]: "Tài khoản đã bị vô hiệu hoá",
  [ErrorCodes.accountLocked]: "Tài khoản tạm thời bị khoá",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const userName = String(form.get("userName") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const missing = requiredFieldErrors(userName, password);
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
        <Card.Title>Đăng nhập</Card.Title>
        <Card.Description>Sử dụng tài khoản được quản trị viên cấp.</Card.Description>
      </Card.Header>

      <Card.Content>
        <Form className="flex flex-col gap-4" validationErrors={fieldErrors} onSubmit={handleSubmit}>
          {showAlert && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{ALERT_TITLES[problem.code] ?? "Không thể đăng nhập"}</Alert.Title>
                <Alert.Description>{problem.detail}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}

          <TextField name="userName" autoComplete="username" autoFocus>
            <Label>Tên đăng nhập</Label>
            <Input placeholder="vd: an.nv" />
            <FieldError />
          </TextField>

          <TextField name="password" type="password" autoComplete="current-password">
            <Label>Mật khẩu</Label>
            <Input />
            <FieldError />
          </TextField>

          <Button type="submit" fullWidth isPending={isSubmitting}>
            {isSubmitting && <Spinner color="current" size="sm" />}
            Đăng nhập
          </Button>
        </Form>
      </Card.Content>
    </Card>
  );
}

function requiredFieldErrors(userName: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!userName) errors.userName = ["Vui lòng nhập tên đăng nhập."];
  if (!password) errors.password = ["Vui lòng nhập mật khẩu."];
  return errors;
}
