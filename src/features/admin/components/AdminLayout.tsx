"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useLocale } from "@/shared/i18n";
import { visibleAdminTabs } from "../lib/tabs";

/**
 * Administration: one tab per area (users, roles & permissions; departments, positions… later). Each tab is its own
 * page (app/(portal)/admin/<tab>), so it has its own URL and loads only its own data. The page title is already in the
 * top bar. Every tab uses the whole width, so the tab bar stays in the same place when switching tabs; the departments
 * chart also takes the height of the screen (a chart needs the room, and the details panel sits beside it).
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission, isAdministrator } = useCurrentUser();
  const { t } = useLocale();
  const tabs = visibleAdminTabs({ hasPermission, isAdministrator });
  const selected = tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  const fillsScreen = selected?.id === "departments";

  return (
    <section aria-label={t("nav.admin")} className={`flex w-full flex-col gap-4${fillsScreen ? " admin-fill" : ""}`}>
      <h1 className="sr-only">{t("nav.admin")}</h1>

      {tabs.length > 0 && (
        // /admin itself opens the first tab, so that one is shown selected meanwhile.
        <Tabs selectedKey={(selected ?? tabs[0]).id} className="w-fit max-w-full">
          <Tabs.ListContainer>
            <Tabs.List aria-label={t("nav.admin")}>
              {tabs.map((tab, index) => (
                <Tabs.Tab
                  key={tab.id}
                  id={tab.id}
                  href={tab.href}
                  className="w-auto shrink-0 whitespace-nowrap"
                  render={(domProps: object) => <Link {...(domProps as { href: string })} />}
                >
                  {index > 0 && <Tabs.Separator />}
                  {t(tab.labelKey)}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      )}

      {fillsScreen ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </section>
  );
}
