import type { Metadata } from "next";
import { OrganizationAdmin } from "@/features/admin";

export const metadata: Metadata = { title: "Tổ chức · Quản trị | Portal" };

export default function Page() {
  return <OrganizationAdmin />;
}
