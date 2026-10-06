import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm, RedirectIfAuthenticated } from "@/features/auth";

export const metadata: Metadata = { title: "Đăng nhập | Portal" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      {/* The login form reads ?returnUrl= with useSearchParams, which needs a Suspense boundary. */}
      <Suspense>
        <RedirectIfAuthenticated>
          <LoginForm />
        </RedirectIfAuthenticated>
      </Suspense>
    </main>
  );
}
