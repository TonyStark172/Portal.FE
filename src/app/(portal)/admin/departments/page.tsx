import type { Metadata } from "next";
import { DepartmentsAdmin } from "@/features/admin";

export const metadata: Metadata = { title: "Phòng ban · Quản trị | Portal" };

export default function Page() {
  return <DepartmentsAdmin />;
}
