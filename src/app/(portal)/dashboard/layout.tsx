import type { Metadata } from "next";
import { DashboardLayout } from "@/features/dashboard";

export const metadata: Metadata = { title: "Tổng quan | Portal" };

export default function Layout({ children }: LayoutProps<"/dashboard">) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
