"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { I18nProvider } from "react-aria";
import { Toast } from "@heroui/react";
import { SessionBootstrap } from "@/shared/session/SessionBootstrap";
import { ThemeWatcher } from "@/shared/theme";
import { makeStore } from "./store";

/** Client-side providers wrapped around every page by the root layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  return (
    <Provider store={store}>
      {/* Dates and numbers in HeroUI fields follow Vietnamese conventions (dd/mm/yyyy), whatever the browser locale. */}
      <I18nProvider locale="vi-VN">
        <ThemeWatcher />
        <Toast.Provider />
        <SessionBootstrap>{children}</SessionBootstrap>
      </I18nProvider>
    </Provider>
  );
}
