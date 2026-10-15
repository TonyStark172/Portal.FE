import type { Metadata } from "next";
import { PositionsAdmin } from "@/features/admin";

export const metadata: Metadata = { title: "Chức danh · Quản trị | Portal" };

export default function Page() {
  return <PositionsAdmin />;
}
