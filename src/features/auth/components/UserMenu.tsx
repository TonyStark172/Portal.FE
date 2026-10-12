"use client";

import type { Key } from "react";
import { useRouter } from "next/navigation";
import { Dropdown, Label } from "@heroui/react";
import { ArrowRightFromSquare, Display, Gear, Person } from "@gravity-ui/icons";
import { useGetMyProfileQuery } from "@/shared/api/generated/portalApi";
import { ThemeSwitch } from "@/shared/theme";
import { useSidebar, useSidebarSurface } from "@/shared/ui/sidebar";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useLocale } from "@/shared/i18n";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useLogout } from "../hooks/useLogout";

/** The signed-in user at the bottom of the sidebar: profile, settings, theme and sign-out. */
export function UserMenu({ onOpenProfile }: { onOpenProfile: () => void }) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { data: profile } = useGetMyProfileQuery(undefined, { skip: !user });
  const logout = useLogout();
  const { locale, setLocale, t } = useLocale();
  const { setMobileOpen } = useSidebar();
  const { isDrawer } = useSidebarSurface();

  const avatar = <UserAvatar fullName={user?.fullName} avatarUrl={profile?.avatarUrl} className="shrink-0" />;

  function handleAction(key: Key) {
    // Like a menu link: leaving for the profile or the settings closes the mobile drawer behind them.
    if (isDrawer && (key === "profile" || key === "settings")) setMobileOpen(false);
    if (key === "profile") onOpenProfile();
    if (key === "settings") router.push("/settings");
    if (key === "logout") void logout();
  }

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={user ? `${t("common.account")}: ${user.fullName}` : t("common.account")}
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

        <Dropdown.Menu aria-label={t("common.account")} onAction={handleAction}>
          <Dropdown.Item id="profile" textValue={t("common.profile")}>
            <Person className="size-4 shrink-0 text-muted" />
            <Label>{t("common.profile")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="settings" textValue={t("common.settings")}>
            <Gear className="size-4 shrink-0 text-muted" />
            <Label>{t("common.settings")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>

        {/* Outside the menu: a menu item must not contain other buttons. */}
        <div className="flex items-center gap-3 px-4 py-1.5 text-sm">
          <Display className="size-4 shrink-0 text-muted" />
          <span className="flex-1">{t("common.appearance")}</span>
          <ThemeSwitch />
        </div>

        <Dropdown.Menu aria-label={t("common.language")} onAction={(key) => setLocale(key === "language-en" ? "en-US" : "vi-VN")}>
          <Dropdown.Item id="language-title" textValue={t("common.language")} isDisabled>
            <span className="flex-1">{t("common.language")}</span>
          </Dropdown.Item>
          <Dropdown.Item id="language-vi" textValue={t("common.vietnamese")}>
            <span className="flex-1">{t("common.vietnamese")}</span>
            {locale === "vi-VN" && <span aria-label="selected">✓</span>}
          </Dropdown.Item>
          <Dropdown.Item id="language-en" textValue={t("common.english")}>
            <span className="flex-1">{t("common.english")}</span>
            {locale === "en-US" && <span aria-label="selected">✓</span>}
          </Dropdown.Item>
        </Dropdown.Menu>

        {/* Only the first menu takes focus on open, so Enter never signs out by accident. */}
        <Dropdown.Menu aria-label={t("common.logout")} autoFocus={false} onAction={handleAction}>
          <Dropdown.Item id="logout" textValue={t("common.logout")} variant="danger">
            <ArrowRightFromSquare className="size-4 shrink-0 text-danger" />
            <Label>{t("common.logout")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
