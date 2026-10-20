import type { Metadata } from "next";
import { AnalyticsLayout } from "@/features/dashboard";

export const metadata: Metadata = { title: "Phân tích | Portal" };

export default function Layout({ children }: LayoutProps<"/dashboard">) {
  return <AnalyticsLayout>{children}</AnalyticsLayout>;
}
