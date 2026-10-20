"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { Spinner } from "@heroui/react";
import { selectSessionStatus } from "@/shared/session/sessionSlice";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { loginUrl } from "../lib/returnUrl";

/** Where someone with an administrator-issued temporary password is kept until they choose their own. */
const CHANGE_PASSWORD_PATH = "/change-password";
/** Where a new account is kept until it has filled in the profile details the organization needs. */
const ONBOARDING_PATH = "/onboarding";

/**
 * Renders its children only for signed-in users; others are sent to the login page
 * and brought back here after signing in.
 *
 * While the account has a temporary password (`mustChangePassword`) the children are not shown either: the user is
 * sent to the change-password page. That page passes `allowPasswordChange` to show its content instead, which is what
 * keeps the redirect from looping. Next, an account that has not finished onboarding (`needsOnboarding`) is sent to
 * the onboarding page, which passes `onboarding`: it is shown only to such an account (anyone else goes home), and
 * still after the password change. Nothing is shown either until the current user has loaded for the first time; a
 * later reload from scratch (a language switch resets the API cache) keeps the page mounted, so drafts are not lost.
 */
export function RequireAuth({
  children,
  allowPasswordChange = false,
  onboarding = false,
}: {
  children: ReactNode;
  allowPasswordChange?: boolean;
  onboarding?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useSelector(selectSessionStatus);
  const { user, mustChangePassword, isLoading: isUserLoading } = useCurrentUser();
  const mustChangeFirst = mustChangePassword && !allowPasswordChange;
  // The change-password page is not sent on: the password comes first, and onboarding follows once it is changed.
  const mustOnboardFirst = !mustChangeFirst && !allowPasswordChange && !onboarding && Boolean(user?.needsOnboarding);
  // Only a loaded user counts: while it reloads (or failed) `needsOnboarding` reads false.
  const isOnboardingDone = onboarding && !mustChangeFirst && user !== undefined && !user.needsOnboarding;
  const redirect = mustChangeFirst ? CHANGE_PASSWORD_PATH : mustOnboardFirst ? ONBOARDING_PATH : isOnboardingDone ? "/" : null;
  const [userKnown, setUserKnown] = useState(false);
  // Only a user query that actually ran counts: while the session is still being looked for (a hard reload) the query is
  // skipped, and a skipped query reports "not loading".
  if (status === "authenticated" && !isUserLoading && !userKnown) setUserKnown(true);

  useEffect(() => {
    if (status === "anonymous") router.replace(loginUrl(pathname));
    else if (status === "authenticated" && redirect) router.replace(redirect);
  }, [status, redirect, pathname, router]);

  // Until the user is first known `mustChangePassword` reads false: waiting keeps the page (and its requests) from starting first.
  if (status !== "authenticated" || (isUserLoading && !userKnown) || redirect) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" aria-label="Đang tải" />
      </div>
    );
  }

  return children;
}
