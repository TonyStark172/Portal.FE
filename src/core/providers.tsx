"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { SessionBootstrap } from "@/shared/session/SessionBootstrap";
import { ThemeWatcher } from "@/shared/theme";
import { makeStore } from "./store";

/** Client-side providers wrapped around every page by the root layout. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore);

  return (
    <Provider store={store}>
      <ThemeWatcher />
      <SessionBootstrap>{children}</SessionBootstrap>
    </Provider>
  );
}
