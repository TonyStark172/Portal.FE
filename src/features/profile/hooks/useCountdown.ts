"use client";

import { useEffect, useState } from "react";

/** Seconds left until a deadline set with `start`, ticking once per second (e.g. "resend code in 42s"). */
export function useCountdown() {
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (endsAt <= Date.now()) return;

    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [endsAt]);

  function start(seconds: number) {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * 1000);
  }

  return { secondsLeft: Math.max(0, Math.ceil((endsAt - now) / 1000)), start };
}
