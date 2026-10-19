import type { Metadata } from "next";
import { AcceptInvitationForm } from "@/features/auth";

export const metadata: Metadata = { title: "Lời mời | Portal" };

/** Outside the app shell and open to anyone: the link in an invitation email, for someone who has no account yet. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <AcceptInvitationForm token={token} />
    </main>
  );
}
