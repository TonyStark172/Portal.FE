"use client";

import { useMemo } from "react";
import { useAppDispatch } from "@/core/hooks";
import type { AppDispatch } from "@/core/store";
import { toApiProblem, type ApiProblem } from "@/shared/api/problem";
import { getStoredLocale } from "@/shared/i18n/locale";
import {
  portalApi,
  type CancelBookingApiArg,
  type GetAudienceApiArg,
  type PreviewMeetingAudienceQuery,
} from "@/shared/api/generated/portalApi";
import type { MeetingConflict, MeetingEditRequest, MeetingWriteRequest } from "./meetingTypes";

/** A failed booking: a problem, plus the occurrences that clash when its code is "meetingConflict". */
export type MeetingProblem = ApiProblem & { conflicts?: MeetingConflict[]; totalCount?: number };
export const meetingProblem = (error: unknown): MeetingProblem => toApiProblem(error);

type Request<T> = { unwrap(): Promise<T>; abort(): void };

/** Ties a request to `signal`: aborting it aborts the request. */
function bound<T>(request: Request<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) request.abort();
  else signal?.addEventListener("abort", () => request.abort(), { once: true });
  return request.unwrap();
}

/**
 * The meetings API, through RTK Query (its session refresh, locale and error handling). Reads are not cached
 * between screens (`subscribe: false`): the calendar asks for what it shows, and a newer request aborts an older one.
 */
export function meetingsClient(dispatch: AppDispatch) {
  const fresh = { subscribe: false, forceRefetch: true } as const;
  // Names of departments and positions come back in the reader's language (Accept-Language), which RTK Query's cache
  // key does not include: the language is added to the argument (the generated query ignores it when building the
  // URL), so a request in one language is never answered, or joined while pending, by one in another.
  const inLanguage = <T extends object>(arg: T): T => ({ ...arg, language: getStoredLocale() });
  // A read asked again is its own request: RTK Query would otherwise join it to an identical one in flight, and
  // aborting that one (a newer range, a closed dialog, React's double mount in development) would abort both.
  let reads = 0;
  const own = <T extends object>(arg: T): T => ({ ...arg, read: ++reads });
  return {
    meetings: (fromUtc: string, toUtc: string, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.getMeetings.initiate(own({ fromUtc, toUtc }), fresh)), signal),
    /** People found by a search, or named by their ids (callers keep what they need, per language). */
    people: (arg: GetAudienceApiArg, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.getAudience.initiate(own(inLanguage(arg)), fresh)), signal),
    departments: (search: string | undefined, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.getMeetingAudienceDepartments.initiate(inLanguage({ search }), { subscribe: false })), signal),
    preview: (query: PreviewMeetingAudienceQuery, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.previewAudience.initiate({ previewMeetingAudienceQuery: query })), signal),
    participants: (id: number, pageNumber: number, pageSize: number, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.getParticipants.initiate(own(inLanguage({ id, pageNumber, pageSize })), fresh)), signal),
    audience: (id: number, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.getAudienceSelection.initiate(own({ id }), fresh)), signal),
    create: (request: MeetingWriteRequest) =>
      dispatch(portalApi.endpoints.createBooking.initiate({ meetingWriteRequest: request })).unwrap(),
    update: (id: number, request: MeetingEditRequest) =>
      dispatch(portalApi.endpoints.updateBooking.initiate({ id, meetingEditRequest: request })).unwrap(),
    cancel: (arg: CancelBookingApiArg) =>
      dispatch(portalApi.endpoints.cancelBooking.initiate(arg)).unwrap(),
  };
}

export type MeetingsClient = ReturnType<typeof meetingsClient>;

export function useMeetingsClient(): MeetingsClient {
  const dispatch = useAppDispatch();
  return useMemo(() => meetingsClient(dispatch), [dispatch]);
}

/** Keeps a mutation's id across retries of the same payload (idempotent on the server); a changed payload gets a new one. */
export function mutationKey(cache: { fingerprint: string; id: string } | null, payload: unknown) {
  const fingerprint = JSON.stringify(payload);
  return cache?.fingerprint === fingerprint ? cache : { fingerprint, id: crypto.randomUUID() };
}
