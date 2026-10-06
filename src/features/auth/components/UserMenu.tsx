"use client";

import { useState } from "react";
import { Avatar, Button } from "@heroui/react";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

/** Name of the signed-in user and the sign-out button, shown in the app header. */
export function UserMenu() {
  const { user } = useCurrentUser();
  const logout = useLogout();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const primaryPosition = user?.assignments.find((a) => a.isPrimary);

  async function handleLogout() {
    setIsSigningOut(true);
    await logout();
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar size="sm">
        <Avatar.Fallback>{initials(user?.fullName)}</Avatar.Fallback>
      </Avatar>
      <div className="hidden text-sm leading-tight sm:block">
        <div className="font-medium">{user?.fullName ?? "…"}</div>
        {primaryPosition && <div className="text-muted">{primaryPosition.positionName}</div>}
      </div>
      <Button size="sm" variant="ghost" isPending={isSigningOut} onPress={handleLogout}>
        Đăng xuất
      </Button>
    </div>
  );
}

function initials(fullName: string | undefined): string {
  if (!fullName) return "?";
  const words = fullName.trim().split(/\s+/);
  return (words.at(-1)?.[0] ?? "").toUpperCase();
}
