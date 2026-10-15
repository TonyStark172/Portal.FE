"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import { useLocale } from "@/shared/i18n";
import { visibleAdminTabs } from "../lib/tabs";

/**
 * Administration: one tab per area (organization, departments, positions, users, roles & permissions). Each tab is its
 * own page (app/(portal)/admin/<tab>), so it has its own URL and loads only its own data. The tabs are a row of
 * labels across the top on every screen, a thin line under the whole row and the current one underlined on it; on a
 * phone the row scrolls sideways. It takes the whole width of the page (tables and the department tree need the room).
 * The page title is already in the top bar.
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission, isAdministrator } = useCurrentUser();
  const { t } = useLocale();
  const tabs = visibleAdminTabs({ hasPermission, isAdministrator });
  const selected = tabs.find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  const row = useRef<HTMLDivElement>(null);
  const selectedId = (selected ?? tabs[0])?.id;

  // On a phone the row is wider than the screen: bring the current tab into view rather than leave it past the edge.
  // Only the row scrolls (block: "nearest" leaves the page where it is).
  useEffect(() => {
    // The tabs are laid out a moment after this render (the tab list builds its items first): wait for the next frame.
    const frame = requestAnimationFrame(() =>
      row.current?.querySelector('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  return (
    <section aria-label={t("nav.admin")} className="flex w-full flex-col gap-6">
      <h1 className="sr-only">{t("nav.admin")}</h1>

      {tabs.length > 0 && (
        // /admin itself opens the first tab, so that one is shown selected meanwhile.
        <div ref={row}>
          <Tabs variant="secondary" selectedKey={selectedId} className="w-full">
            <Tabs.ListContainer>
              <Tabs.List aria-label={t("nav.admin")}>
                {tabs.map((tab) => (
                  <Tabs.Tab
                    key={tab.id}
                    id={tab.id}
                    href={tab.href}
                    className="w-auto shrink-0 whitespace-nowrap px-3 text-sm font-medium"
                    render={(domProps: object) => <Link {...(domProps as { href: string })} />}
                  >
                    {t(tab.labelKey)}
                    <Tabs.Indicator className="bg-foreground" />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </div>
      )}

      {children}
    </section>
  );
}
