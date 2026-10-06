import { AppShell } from "@/core/layout/AppShell";
import { RequireAuth } from "@/features/auth";

/** Every page in the (portal) group requires a signed-in user and uses the app shell. */
export default function PortalLayout({ children }: LayoutProps<"/">) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
