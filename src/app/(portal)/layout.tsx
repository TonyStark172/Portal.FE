import { cookies } from "next/headers";
import { AppShell } from "@/core/layout/AppShell";
import { RequireAuth } from "@/features/auth";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/shared/ui/sidebar/cookie";

/** Every page in the (portal) group requires a signed-in user and uses the app shell. */
export default async function PortalLayout({ children }: LayoutProps<"/">) {
  // Read on the server so the sidebar is rendered collapsed or expanded from the first paint.
  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;

  return (
    <RequireAuth>
      <AppShell defaultCollapsed={sidebarCollapsed}>{children}</AppShell>
    </RequireAuth>
  );
}
