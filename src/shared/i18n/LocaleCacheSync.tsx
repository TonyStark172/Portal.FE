"use client";

import { useEffect } from "react";
import { useStore } from "react-redux";
import { portalApi } from "@/shared/api/generated/portalApi";
import { getStoredLocale, subscribeToLocale } from "./locale";
import type { AppStore } from "@/core/store";

/** Drop locale-dependent entries, including pending requests, before refetching active queries. */
export function LocaleCacheSync() {
  const store = useStore<AppStore>();
  useEffect(() => {
    let previous = getStoredLocale();
    return subscribeToLocale(() => {
      const next = getStoredLocale();
      if (next === previous) return;
      previous = next;
      store.dispatch(portalApi.util.resetApiState());
    });
  }, [store]);
  return null;
}
