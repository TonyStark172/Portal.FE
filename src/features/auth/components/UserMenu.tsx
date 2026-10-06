"use client";

import { Avatar, Dropdown } from "@heroui/react";
import { ArrowRightFromSquare, ChevronsExpandVertical } from "@gravity-ui/icons";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

/** The signed-in user at the bottom of the sidebar; opens a menu with "Đăng xuất". */
export function UserMenu() {
  const { user } = useCurrentUser();
  const logout = useLogout();

  const primaryPosition = user?.assignments.find((a) => a.isPrimary);

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label="Tài khoản"
        className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus"
      >
        <Avatar size="sm" className="shrink-0">
          <Avatar.Fallback>{initials(user?.fullName)}</Avatar.Fallback>
        </Avatar>
        <span className="min-w-0 flex-1 text-sm leading-tight group-data-[state=collapsed]/sidebar:sr-only">
          <span className="block truncate font-medium">{user?.fullName ?? "…"}</span>
          {primaryPosition && <span className="block truncate text-xs text-muted">{primaryPosition.positionName}</span>}
        </span>
        <ChevronsExpandVertical className="size-4 shrink-0 text-muted group-data-[state=collapsed]/sidebar:hidden" />
      </Dropdown.Trigger>

      <Dropdown.Popover placement="top start" className="min-w-52">
        <Dropdown.Menu aria-label="Tài khoản" onAction={(key) => key === "logout" && logout()}>
          <Dropdown.Item id="logout" textValue="Đăng xuất" className="text-danger">
            <ArrowRightFromSquare className="size-4" />
            Đăng xuất
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
