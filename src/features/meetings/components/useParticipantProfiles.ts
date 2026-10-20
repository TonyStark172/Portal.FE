"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/shared/i18n/LocaleProvider";
import { useMeetingsClient } from "../meetingsClient";
import type { AudiencePerson } from "../meetingTypes";

const BATCH = 50;

/**
 * Names (and avatars, positions) of the people picked, looked up 50 at a time and kept while the form is open.
 * `failed`: some could not be named (the lookup failed, or does not know them); `retry` asks again for those.
 */
export function useParticipantProfiles(ids: number[]) {
  const { locale } = useLocale();
  const client = useMeetingsClient();
  const [profiles, setProfiles] = useState<Record<number, AudiencePerson>>({});
  const cache = useRef<{ locale: string; people: Record<number, AudiencePerson> }>({ locale, people: {} });
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const key = ids.join(",");

  useEffect(() => {
    if (cache.current.locale !== locale) cache.current = { locale, people: {} };
    const missing = key.split(",").filter(Boolean).map(Number).filter(id => !cache.current.people[id]);
    if (!missing.length) return;
    const controller = new AbortController();
    const batches = Array.from({ length: Math.ceil(missing.length / BATCH) }, (_, index) => missing.slice(index * BATCH, (index + 1) * BATCH));
    void Promise.allSettled(batches.map(batch => client.people({ ids: batch.join(","), pageSize: BATCH }, controller.signal))).then(results => {
      if (controller.signal.aborted) return;
      for (const result of results)
        if (result.status === "fulfilled") for (const person of result.value.items) cache.current.people[person.userId] = person;
      setProfiles({ ...cache.current.people });
      setFailed(missing.some(id => !cache.current.people[id]));
    });
    return () => controller.abort();
  }, [key, locale, attempt, client]);

  return {
    profiles,
    failed,
    retry: () => setAttempt(n => n + 1),
    /** A person just picked from a search: named at once, without asking again. */
    remember: (person: AudiencePerson) => {
      cache.current.people[person.userId] = person;
      setProfiles({ ...cache.current.people });
    },
  };
}
