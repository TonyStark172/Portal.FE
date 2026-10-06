"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserMenu, useCurrentUser } from "@/features/auth";
import { navigation } from "./navigation";

/** Layout of every signed-in page: header, permission-aware sidebar and content. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { hasPermission } = useCurrentUser();

  const items = navigation.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-separator px-4">
        <Link href="/" className="text-lg font-semibold">
          Portal
        </Link>
        <UserMenu />
      </header>

      <div className="flex flex-1">
        <nav className="w-56 shrink-0 border-r border-separator p-3" aria-label="Menu chính">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-default aria-[current=page]:bg-default aria-[current=page]:font-medium"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
