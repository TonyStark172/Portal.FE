import type { Metadata } from "next";
import { StaffEmployees } from "@/features/dashboard";

export const metadata: Metadata = { title: "Nhân sự | Portal" };

export default function Page() {
  return <StaffEmployees />;
}
