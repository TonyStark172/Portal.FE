"use client";

import { useState, type ReactNode } from "react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@heroui/react";
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
import { navigation } from "./navigation";

/** Layout of every signed-in page: permission-aware sidebar, top bar with the page title, content. */
export function AppShell({ defaultCollapsed, children }: { defaultCollapsed: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission } = useCurrentUser();
  const [isProfileOpen, setProfileOpen] = useState(false);

  const items = navigation.filter((item) => !item.permission || hasPermission(item.permission));
  const current = items.find((item) => item.href === pathname);

  return (
    <SidebarProvider defaultCollapsed={defaultCollapsed}>
      <Sidebar label="Menu chính">
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
          <SidebarMenu label="Điều hướng chính">
            {items.map(({ href, label, icon: Icon }) => (
              <SidebarMenuLink key={href} href={href} icon={<Icon />} isActive={href === pathname}>
                {label}
              </SidebarMenuLink>
            ))}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
          <UserMenu onOpenProfile={() => setProfileOpen(true)} />
        </SidebarFooter>
      </Sidebar>

      <SidebarMain>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-separator bg-background px-4">
          <SidebarTrigger />
          {current && (
            <Breadcrumbs className="min-w-0">
              <Breadcrumbs.Item className="min-w-0 font-semibold">
                <span className="flex min-w-0 items-center gap-2">
                  <current.icon className="size-4 shrink-0" />
                  <span className="truncate">{current.label}</span>
                </span>
              </Breadcrumbs.Item>
            </Breadcrumbs>
          )}
        </header>

        <main className="flex-1 p-6">{children}</main>
      </SidebarMain>

      <ProfileDrawer isOpen={isProfileOpen} onOpenChange={setProfileOpen} />
    </SidebarProvider>
  );
}
