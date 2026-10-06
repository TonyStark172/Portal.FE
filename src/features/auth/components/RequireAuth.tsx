"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { Spinner } from "@heroui/react";
import { selectSessionStatus } from "@/shared/session/sessionSlice";
import { loginUrl } from "../lib/returnUrl";

/**
 * Renders its children only for signed-in users; others are sent to the login page
 * and brought back here after signing in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useSelector(selectSessionStatus);

  useEffect(() => {
    if (status === "anonymous") router.replace(loginUrl(pathname));
  }, [status, pathname, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" aria-label="Đang tải" />
      </div>
    );
  }

  return children;
}
