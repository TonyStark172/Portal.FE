import type { Metadata } from "next";
import { RequireAuth } from "@/features/auth";
import { OnboardingFlow } from "@/features/onboarding";

export const metadata: Metadata = { title: "Chào mừng | Portal" };

/** Outside the app shell: a new account sees only this until its profile has what the organization needs. */
export default function OnboardingPage() {
  return (
    <main className="min-h-dvh bg-background">
      <RequireAuth onboarding>
        <OnboardingFlow />
      </RequireAuth>
    </main>
  );
}
