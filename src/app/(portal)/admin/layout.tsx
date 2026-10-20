import type { Metadata } from "next";
import { AdminLayout } from "@/features/admin";

export const metadata: Metadata = { title: "Quản trị | Portal" };

export default function Layout({ children }: LayoutProps<"/admin">) {
  return <AdminLayout>{children}</AdminLayout>;
}
