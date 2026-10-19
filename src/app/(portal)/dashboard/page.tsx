import type { Metadata } from "next";
import { StaffDashboard } from "@/features/dashboard";

export const metadata: Metadata = { title: "Phân tích | Portal" };

export default function Page() {
  return <StaffDashboard />;
}
