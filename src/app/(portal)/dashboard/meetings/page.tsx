import type { Metadata } from "next";
import { MeetingDashboard } from "@/features/dashboard";

export const metadata: Metadata = { title: "Cuộc họp · Phân tích | Portal" };

export default function Page() {
  return <MeetingDashboard />;
}
