import type { Metadata } from "next";
import type { ReactNode } from "react";

// The page is the portal's calendar (meetings, company events, birthdays and anniversaries); its address stays /meetings.
export const metadata: Metadata = { title: "Lịch | Portal" };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
