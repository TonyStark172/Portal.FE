"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { Toast } from "@heroui/react";
import { SessionBootstrap } from "@/shared/session/SessionBootstrap";
import { ThemeWatcher } from "@/shared/theme";
import { LocaleProvider } from "@/shared/i18n";
import { LocaleCacheSync } from "@/shared/i18n/LocaleCacheSync";
import { makeStore } from "./store";

/** Client-side providers wrapped around every page by the root layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  return (
    <Provider store={store}>
      <LocaleProvider>
        <LocaleCacheSync />
        <ThemeWatcher />
        <Toast.Provider />
        <SessionBootstrap>{children}</SessionBootstrap>
      </LocaleProvider>
    </Provider>
  );
}
