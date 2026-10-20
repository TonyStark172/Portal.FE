"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Spinner, Tabs } from "@heroui/react";
import { useCurrentUser } from "@/features/auth";
import type { DashboardPeriod } from "@/shared/api/generated/portalApi";
import { useLocale } from "@/shared/i18n";
import { analyticsTabFor, visibleAnalyticsTabs } from "../lib/tabs";
import { AnalyticsContext } from "./AnalyticsPeriod";

/**
 * "Phân tích" (analytics): one tab per area — HR (the staff analytics, at /dashboard) and meetings — each its own page
 * (app/(portal)/dashboard/…), so each has a link that can be shared and loads only its own figures. Only the tabs the
 * user may see are offered, and with a single one there is no tab bar. The period picker sits at the end of the tabs'
 * row (each tab puts it there); this layout stays mounted while switching tabs, so the period chosen carries over.
 * The page title is already in the top bar.
 */
export function AnalyticsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasPermission, isLoading } = useCurrentUser();
  const { t } = useLocale();
  const [period, setPeriod] = useState<DashboardPeriod>("Month");
  const [toolbar, setToolbar] = useState<HTMLElement | null>(null);
  const tabs = visibleAnalyticsTabs(hasPermission);
  const current = analyticsTabFor(pathname);
  const selected = current && tabs.includes(current) ? current : tabs[0];
  // The menu's entry leads to /dashboard, the HR tab: whoever may not see it but may see another tab lands there.
  const landing = !isLoading && current?.id === "staff" && !tabs.includes(current) ? tabs[0] : undefined;
  const context = useMemo(() => ({ period, setPeriod, toolbar }), [period, toolbar]);

  useEffect(() => {
    if (landing) router.replace(landing.href);
  }, [landing, router]);

  return (
    <section aria-label={t("nav.analytics")} className="flex w-full flex-col gap-4">
      <h1 className="sr-only">{t("nav.analytics")}</h1>

      <div data-analytics-toolbar className="flex flex-wrap items-center gap-3">
        {tabs.length > 1 && selected && (
          <Tabs selectedKey={selected.id} className="w-fit max-w-full">
            <Tabs.ListContainer>
              <Tabs.List aria-label={t("nav.analytics")}>
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
        <div ref={setToolbar} className="ms-auto flex items-center gap-2" />
      </div>

      <AnalyticsContext.Provider value={context}>
        {landing ? (
          <div className="flex justify-center py-10">
            <Spinner aria-label={t("dashboard.loadingStats")} />
          </div>
        ) : (
          children
        )}
      </AnalyticsContext.Provider>
    </section>
  );
}
