import type { Metadata } from "next";
import { RolesAdmin } from "@/features/admin";

export const metadata: Metadata = { title: "Vai trò & quyền · Quản trị | Portal" };

export default function Page() {
  return <RolesAdmin />;
}
