"use client";

import { useState, type ReactNode } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs, Button } from "@heroui/react";
import { Bell, Magnifier } from "@gravity-ui/icons";
import { UserMenu, useCurrentUser } from "@/features/auth";
import { ProfileDrawer } from "@/features/profile";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMain,
  SidebarMenu,
  SidebarMenuLink,
  SidebarProvider,
  SidebarTrigger,
} from "@/shared/ui/sidebar";
import { accountPages, isNavItemActive, isNavItemVisible, navigation } from "./navigation";
import { useLocale } from "@/shared/i18n";

/** Layout of every signed-in page: permission-aware sidebar, top bar with the page title, content. */
export function AppShell({ defaultCollapsed, children }: { defaultCollapsed: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission } = useCurrentUser();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const { t } = useLocale();

  const items = navigation.filter((item) => isNavItemVisible(item, hasPermission));
  const current = [...items, ...accountPages].find((item) => isNavItemActive(item, pathname));

  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <Sidebar label={t("nav.menu")}>
        <SidebarHeader>
          <NextLink
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm text-accent-foreground"
            >
              P
            </span>
            <span className="truncate group-data-[state=collapsed]/sidebar:sr-only">Portal</span>
          </NextLink>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu label={t("nav.main")}>
            {items.map((item) => (
              <SidebarMenuLink key={item.href} href={item.href} icon={<item.icon />} isActive={item === current}>
                {item.labelKey ? t(item.labelKey) : item.label}
              </SidebarMenuLink>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
          <UserMenu onOpenProfile={() => setProfileOpen(true)} />
        </SidebarFooter>
      </Sidebar>

      <SidebarMain>
        <header className="sticky top-0 z-10 flex h-(--app-header-height) items-center gap-3 border-b border-separator bg-background px-4 text-foreground">
          <SidebarTrigger />
          {current && (
            <Breadcrumbs className="min-w-0">
              <Breadcrumbs.Item className="min-w-0 font-semibold">
                <span className="flex min-w-0 items-center gap-2">
                  <current.icon className="size-4 shrink-0" />
                  <span className="truncate">{current.labelKey ? t(current.labelKey) : current.label}</span>
                </span>
              </Breadcrumbs.Item>
            </Breadcrumbs>
          )}
          <div className="ms-auto flex items-center gap-1">
            <Button isIconOnly aria-label={t("common.search")} variant="ghost">
              <Magnifier className="size-4" />
            </Button>
            <Button isIconOnly aria-label={t("common.notifications")} variant="ghost">
              <Bell className="size-4" />
            </Button>
          </div>
        </header>

        {/* Its padding (globals.css: 12px, 24px from `sm`) is what full-height pages leave room for. */}
        <main className="flex-1 p-(--app-main-padding)">{children}</main>
      </SidebarMain>

      <ProfileDrawer isOpen={isProfileOpen} onOpenChange={setProfileOpen} />
    </SidebarProvider>
  );
}
