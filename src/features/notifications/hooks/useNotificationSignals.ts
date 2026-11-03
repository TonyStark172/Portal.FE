"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { NotificationSignalKind } from "../api";

type Listener = (kind: NotificationSignalKind) => void;
type Subscribe = (listener: Listener) => () => void;

/** The bell owns the only hub connection of the page; whatever of it is open at the time hears the signals through this. */
export const NotificationSignalsContext = createContext<Subscribe>(() => () => {});

/** Who is listening to the signals, and a way to tell them all; both keep their identity for the life of the caller. */
export function useSignalSource() {
  const [source] = useState(() => {
    const listeners = new Set<Listener>();
    const subscribe: Subscribe = (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    };
    const emit: Listener = (kind) => listeners.forEach((listener) => listener(kind));
    return { subscribe, emit };
  });
  return source;
}

/** Calls `listener` with the kind of every signal the bell hears while the caller is mounted. */
export function useNotificationSignals(listener: Listener): void {
  const subscribe = useContext(NotificationSignalsContext);
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => subscribe((kind) => latest.current(kind)), [subscribe]);
}
