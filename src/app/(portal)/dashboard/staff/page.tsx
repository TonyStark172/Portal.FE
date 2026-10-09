import type { Metadata } from "next";
import { StaffDashboard } from "@/features/dashboard";

export const metadata: Metadata = { title: "Nhân sự · Tổng quan | Portal" };

export default function Page() {
  return <StaffDashboard />;
}
