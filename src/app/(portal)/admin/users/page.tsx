import type { Metadata } from "next";
import { UsersAdmin } from "@/features/admin";

export const metadata: Metadata = { title: "Người dùng · Quản trị | Portal" };

export default function Page() {
  return <UsersAdmin />;
}
