"use client";

import { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardPeriod } from "@/shared/api/generated/portalApi";
import { PeriodSelect } from "./layout/PeriodSelect";

type AnalyticsContextValue = {
  period: DashboardPeriod;
  setPeriod: (period: DashboardPeriod) => void;
  /** The end of the tabs' row, where the current tab puts its controls. */
  toolbar: HTMLElement | null;
};

/** Held by the analytics layout, which stays mounted while switching tabs, so the period chosen carries over. */
export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

/** The period the analytics tabs share; a tab rendered on its own (e.g. in a test) keeps one of its own. */
export function useAnalyticsPeriod(): [DashboardPeriod, (period: DashboardPeriod) => void] {
  const shared = useContext(AnalyticsContext);
  const [own, setOwn] = useState<DashboardPeriod>("Month");
  return shared ? [shared.period, shared.setPeriod] : [own, setOwn];
}

/** The period picker of a tab: on the tabs' row, or above the tab when it is rendered on its own. */
export function AnalyticsPeriodSelect({ value, onChange }: { value: DashboardPeriod; onChange: (period: DashboardPeriod) => void }) {
  const shared = useContext(AnalyticsContext);
  const picker = <PeriodSelect value={value} onChange={onChange} />;
  // Inside the layout, nothing until its row is in the page (its first render), so the picker never jumps there.
  if (shared) return shared.toolbar ? createPortal(picker, shared.toolbar) : null;
  return <div className="flex justify-end">{picker}</div>;
}
