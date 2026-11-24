"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { invokeHub, useHubSignal } from "@/shared/realtime/hub";

/** A typing signal shows for this long unless repeated (the sender repeats it every few seconds while typing). */
const TYPING_SHOWN_MS = 5_000;
/** The sender tells the hub at most this often while typing. */
const TYPING_REPEAT_MS = 3_000;

/** Who is typing in the conversation right now, as user ids; someone whose message arrives stops showing. */
export function useTypingUsers(conversationId: number, lastSenderKey: string): number[] {
  const [typing, setTyping] = useState<Record<number, number>>({});

  useHubSignal((signal) => {
    if (signal.kind !== "Typing" || signal.conversationId !== conversationId || !signal.userId) return;
    setTyping((current) => ({ ...current, [signal.userId!]: Date.now() + TYPING_SHOWN_MS }));
  });

  // A message from someone means they have finished typing it.
  const [seenKey, setSeenKey] = useState(lastSenderKey);
  if (seenKey !== lastSenderKey) {
    setSeenKey(lastSenderKey);
    const senderId = Number(lastSenderKey.split(":")[1]);
    if (senderId in typing) {
      const next = { ...typing };
      delete next[senderId];
      setTyping(next);
    }
  }

  // Drops each one once its time is up.
  useEffect(() => {
    const times = Object.values(typing);
    if (times.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setTyping((current) => Object.fromEntries(Object.entries(current).filter(([, until]) => until > now)));
    }, Math.max(0, Math.min(...times) - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [typing]);

  return Object.keys(typing).map(Number);
}

/** Returns a function to call on each keystroke: it tells the others at most every few seconds. */
export function useTypingNotifier(conversationId: number): () => void {
  const last = useRef(0);
  useEffect(() => {
    last.current = 0;
  }, [conversationId]);

  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < TYPING_REPEAT_MS) return;
    last.current = now;
    invokeHub("Typing", conversationId);
  }, [conversationId]);
}
