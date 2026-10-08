"use client";

import type { Key } from "react";
import { useRouter } from "next/navigation";
import { Dropdown, Label } from "@heroui/react";
import { ArrowRightFromSquare, Display, Gear, Person } from "@gravity-ui/icons";
import { useGetMyProfileQuery } from "@/shared/api/generated/portalApi";
import { ThemeSwitch } from "@/shared/theme";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

/** The signed-in user at the bottom of the sidebar: profile, settings, theme and sign-out. */
export function UserMenu({ onOpenProfile }: { onOpenProfile: () => void }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !user });
  const logout = useLogout();

  const avatar = <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} className="shrink-0" />;

  function handleAction(key: Key) {
    if (key === "profile") onOpenProfile();
    if (key === "settings") router.push("/settings");
    if (key === "logout") void logout();
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={user ? `Tài khoản: ${user.fullName}` : "Tài khoản"}
        className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left outline-none hover:bg-default focus-visible:ring-2 focus-visible:ring-focus group-data-[state=collapsed]/sidebar:justify-center"
      >
        {avatar}
        <span className="min-w-0 flex-1 truncate text-sm font-medium group-data-[state=collapsed]/sidebar:sr-only">
          {user?.fullName ?? "…"}
        </span>
      </Dropdown.Trigger>

      <Dropdown.Popover placement="top start" className="min-w-64">
        <div className="flex items-center gap-3 px-3 pt-3 pb-1">
          {avatar}
          <div className="min-w-0 text-sm leading-tight">
            <div className="truncate font-medium">{user?.fullName ?? "…"}</div>
            <div className="truncate text-xs text-muted">{user?.email ?? user?.userName}</div>
          </div>
        </div>

        <Dropdown.Menu aria-label="Tài khoản" onAction={handleAction}>
          <Dropdown.Item id="profile" textValue="Hồ sơ">
            <Person className="size-4 shrink-0 text-muted" />
            <Label>Hồ sơ</Label>
          </Dropdown.Item>
          <Dropdown.Item id="settings" textValue="Cài đặt">
            <Gear className="size-4 shrink-0 text-muted" />
            <Label>Cài đặt</Label>
          </Dropdown.Item>
        </Dropdown.Menu>

        {/* Outside the menu: a menu item must not contain other buttons. */}
        <div className="flex items-center gap-3 px-4 py-1.5 text-sm">
          <Display className="size-4 shrink-0 text-muted" />
          <span className="flex-1">Giao diện</span>
          <ThemeSwitch />
        </div>

        {/* Only the first menu takes focus on open, so Enter never signs out by accident. */}
        <Dropdown.Menu aria-label="Đăng xuất" autoFocus={false} onAction={handleAction}>
          <Dropdown.Item id="logout" textValue="Đăng xuất" variant="danger">
            <ArrowRightFromSquare className="size-4 shrink-0 text-danger" />
            <Label>Đăng xuất</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
