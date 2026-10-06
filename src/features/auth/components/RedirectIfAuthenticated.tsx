"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { selectSessionStatus } from "@/shared/session/sessionSlice";
import { RETURN_URL_PARAM, safeReturnUrl } from "../lib/returnUrl";

/** Keeps signed-in users away from the login page. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useSelector(selectSessionStatus);

  useEffect(() => {
    if (status === "authenticated") router.replace(safeReturnUrl(searchParams.get(RETURN_URL_PARAM)));
  }, [status, searchParams, router]);

  return status === "authenticated" ? null : children;
}
