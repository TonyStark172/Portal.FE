import { Suspense } from "react";
import type { Metadata } from "next";
import { RolesAdmin } from "@/features/admin";

export const metadata: Metadata = { title: "Vai trò & quyền · Quản trị | Portal" };

export default function Page() {
  return (
    // The page keeps the role shown in the URL (useSearchParams), which needs a Suspense boundary.
    <Suspense>
      <RolesAdmin />
    </Suspense>
  );
}
