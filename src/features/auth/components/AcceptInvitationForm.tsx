"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, buttonVariants, Card, Description, FieldError, Form, Input, Label, Spinner, TextField } from "@heroui/react";
import { useAppDispatch } from "@/core/hooks";
import { formatExpiry } from "@/features/admin/lib/dates";
import { useGetInvitationPreviewQuery } from "@/shared/api/generated/portalApi";
import { ApiProblemError, ErrorCodes, toApiProblem, toFieldErrors } from "@/shared/api/problem";
import { acceptInvitation } from "@/shared/session/sessionClient";
import { signedIn } from "@/shared/session/sessionSlice";
import { useLocale } from "@/shared/i18n";
import { isStrongPassword } from "../lib/passwordRules";

type FieldErrors = Record<string, string[]>;

/** Why the invitation cannot be taken up: 404 (unknown or used) and 410 (expired or revoked) say different things. */
type Dead = 404 | 410;
const deadOf = (status: number): Dead | null => (status === 404 || status === 410 ? status : null);

/**
 * The page an invitation email links to, for someone with no account: what they are invited to (the company, their
 * address, the role and until when), then their full name, a username and a password typed twice. Accepting creates the
 * account and signs in as it (through the session route, as the login form does), then opens the home page. An
 * invitation that cannot be used, on opening or on accepting, says why instead of the form.
 */
export function AcceptInvitationForm({ token }: { token: string }) {
  const { t, locale } = useLocale();
  const preview = useGetInvitationPreviewQuery({ token: encodeURIComponent(token) });
  // An invitation that died while the form was open (its answer to accepting) wins over the preview read before.
  const [diedOnAccept, setDiedOnAccept] = useState<Dead | null>(null);

  const dead = diedOnAccept ?? (preview.isError ? deadOf(toApiProblem(preview.error).status) : null);
  if (dead) return <DeadInvitation reason={dead} />;

  if (preview.isLoading) {
    return <Spinner aria-label={t("invite.opening")} />;
  }

  if (!preview.data) {
    return (
      <Alert status="danger" role="alert" className="w-full max-w-sm">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Description>{t("invite.loadError")}</Alert.Description>
        </Alert.Content>
        <Button size="sm" variant="secondary" onPress={() => void preview.refetch()}>
          {t("common.retry")}
        </Button>
      </Alert>
    );
  }

  const { organizationName, email, roleName, expiresAt } = preview.data;
  return (
    <Card className="w-full max-w-sm">
      <Card.Header>
        <Card.Title>{t("invite.title").replace("{organization}", organizationName)}</Card.Title>
        <Card.Description>{t("invite.subtitle")}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted">{t("invite.email")}</dt>
          <dd className="min-w-0 break-all font-medium">{email}</dd>
          <dt className="text-muted">{t("invite.role")}</dt>
          <dd className="font-medium">{roleName}</dd>
        </dl>
        <p className="text-xs text-muted">{t("invite.expiresAt").replace("{time}", formatExpiry(expiresAt, locale))}</p>
        <AccountForm token={token} onDead={setDiedOnAccept} />
      </Card.Content>
    </Card>
  );
}

function AccountForm({ token, onDead }: { token: string; onDead: (reason: Dead) => void }) {
  const { t } = useLocale();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [fullName, setFullName] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: FieldErrors = {};
    if (!isStrongPassword(password)) found.password = [t("auth.passwordRules")];
    if (password !== again) found.confirm = [t("auth.passwordsDiffer")];
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setIsSubmitting(true);
    try {
      dispatch(signedIn(await acceptInvitation(token, { fullName: fullName.trim(), userName: userName.trim(), password })));
      router.replace("/");
    } catch (error) {
      const problem = error instanceof ApiProblemError ? error.problem : toApiProblem(error);
      const dead = deadOf(problem.status);
      if (dead) onDead(dead);
      else if (problem.code === ErrorCodes.validationFailed) setErrors(toFieldErrors(problem));
      else setFailure(problem.detail ?? t("common.genericError"));
      setIsSubmitting(false);
    }
  }

  return (
    // POST to its own page: a submit before hydration must never put the password in the URL.
    <Form className="flex flex-col gap-4" method="post" validationErrors={errors} onSubmit={submit}>
      {failure && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{failure}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      <TextField name="fullName" isRequired autoFocus variant="secondary" value={fullName} onChange={setFullName}>
        <Label>{t("invite.fullName")}</Label>
        <Input autoComplete="name" />
        <FieldError />
      </TextField>
      <TextField name="userName" isRequired variant="secondary" value={userName} onChange={setUserName}>
        <Label>{t("invite.userName")}</Label>
        <Input autoComplete="username" />
        <FieldError />
      </TextField>
      <TextField name="password" type="password" isRequired variant="secondary" value={password} onChange={setPassword}>
        <Label>{t("invite.password")}</Label>
        <Input autoComplete="new-password" />
        {/* The rule, until it is the error itself. */}
        {!errors.password && <Description>{t("auth.passwordRules")}</Description>}
        <FieldError />
      </TextField>
      <TextField name="confirm" type="password" isRequired variant="secondary" value={again} onChange={setAgain}>
        <Label>{t("invite.confirmPassword")}</Label>
        <Input autoComplete="new-password" />
        <FieldError />
      </TextField>
      <Button type="submit" fullWidth isPending={isSubmitting}>
        {t("invite.submit")}
      </Button>
    </Form>
  );
}

function DeadInvitation({ reason }: { reason: Dead }) {
  const { t } = useLocale();
  return (
    <Card className="w-full max-w-sm">
      <Card.Header>
        <Card.Title>{t(reason === 404 ? "invite.notFound" : "invite.gone")}</Card.Title>
        <Card.Description>{t(reason === 404 ? "invite.notFoundHint" : "invite.goneHint")}</Card.Description>
      </Card.Header>
      <Card.Content>
        <Link href="/login" className={buttonVariants({ variant: "secondary", fullWidth: true })}>
          {t("invite.toLogin")}
        </Link>
      </Card.Content>
    </Card>
  );
}
