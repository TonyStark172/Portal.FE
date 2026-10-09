"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { visibleDashboardTabs } from "../lib/tabs";
import { DashboardToolbarSlot } from "./DashboardToolbar";

/**
 * The dashboard: one tab per area of statistics (staff, later meetings…) with the current tab's own controls on
 * the same row. Each tab is its own page (app/(portal)/dashboard/<tab>), so it has its own URL and loads only its
 * own figures. The page title is already in the top bar.
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission } = useCurrentUser();
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  const tabs = visibleDashboardTabs(hasPermission);
  const selected = tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));

  return (
    <section aria-label="Tổng quan" className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <h1 className="sr-only">Tổng quan</h1>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {tabs.length > 0 && (
          // /dashboard itself opens the first tab, so that one is shown selected meanwhile.
          <Tabs selectedKey={(selected ?? tabs[0]).id} className="w-fit max-w-full">
            <Tabs.ListContainer>
              <Tabs.List aria-label="Mục thống kê">
                {tabs.map((tab, index) => (
                  <Tabs.Tab
                    key={tab.id}
                    id={tab.id}
                    href={tab.href}
                    render={(domProps: object) => <Link {...(domProps as { href: string })} />}
                  >
                    {index > 0 && <Tabs.Separator />}
                    {tab.label}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        )}
        <div ref={setToolbarSlot} className="flex items-center gap-2" />
      </div>

      <DashboardToolbarSlot.Provider value={toolbarSlot}>{children}</DashboardToolbarSlot.Provider>
    </section>
  );
}
