"use client";

import { useRouter } from "next/navigation";
import { Avatar, Dropdown, Label } from "@heroui/react";
import { ArrowRightFromSquare, ChevronsExpandVertical, Person } from "@gravity-ui/icons";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

/** The signed-in user at the bottom of the sidebar; opens a menu with the profile and "Đăng xuất". */
export function UserMenu() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const logout = useLogout();

  const primaryPosition = user?.assignments.find((a) => a.isPrimary);
  const avatar = (
    <Avatar size="sm" className="shrink-0">
      <Avatar.Fallback>{initials(user?.fullName)}</Avatar.Fallback>
    </Avatar>
  );

  function handleAction(key: React.Key) {
    if (key === "profile") router.push("/profile");
    if (key === "logout") void logout();
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Tài khoản"
        className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus group-data-[state=collapsed]/sidebar:justify-center"
      >
        {avatar}
        <span className="min-w-0 flex-1 text-sm leading-tight group-data-[state=collapsed]/sidebar:sr-only">
          <span className="block truncate font-medium">{user?.fullName ?? "…"}</span>
          {primaryPosition && <span className="block truncate text-xs text-muted">{primaryPosition.positionName}</span>}
        </span>
        <ChevronsExpandVertical className="size-4 shrink-0 text-muted group-data-[state=collapsed]/sidebar:hidden" />
      </Dropdown.Trigger>

      <Dropdown.Popover placement="top start" className="min-w-60">
        <div className="flex items-center gap-3 px-3 pt-3 pb-2">
          {avatar}
          <div className="min-w-0 text-sm leading-tight">
            <div className="truncate font-medium">{user?.fullName ?? "…"}</div>
            <div className="truncate text-xs text-muted">{user?.email ?? user?.userName}</div>
          </div>
        </div>

        <Dropdown.Menu aria-label="Tài khoản" onAction={handleAction}>
          <Dropdown.Item id="profile" textValue="Hồ sơ">
            <Label className="flex-1">Hồ sơ</Label>
            <Person className="size-4 text-muted" />
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue="Đăng xuất" variant="danger">
            <Label className="flex-1">Đăng xuất</Label>
            <ArrowRightFromSquare className="size-4 text-danger" />
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function initials(fullName: string | undefined): string {
  if (!fullName) return "?";
  const words = fullName.trim().split(/\s+/);
  return (words.at(-1)?.[0] ?? "").toUpperCase();
}
