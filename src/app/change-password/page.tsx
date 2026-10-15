import type { Metadata } from "next";
import { ChangePasswordForm, RequireAuth } from "@/features/auth";

export const metadata: Metadata = { title: "Đổi mật khẩu | Portal" };

/** Outside the app shell: someone with a temporary password sees only this until they change it. */
export default function ChangePasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <RequireAuth allowPasswordChange>
        <ChangePasswordForm />
      </RequireAuth>
    </main>
  );
}
