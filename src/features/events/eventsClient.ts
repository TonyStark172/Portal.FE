"use client";

import { useMemo } from "react";
import { useAppDispatch } from "@/core/hooks";
import type { AppDispatch } from "@/core/store";
import { portalApi } from "@/shared/api/generated/portalApi";
import type { CompanyEventWriteRequest } from "./eventTypes";

type Request<T> = { unwrap(): Promise<T>; abort(): void };

/** Ties a request to `signal`: aborting it aborts the request. */
function bound<T>(request: Request<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) request.abort();
  else signal?.addEventListener("abort", () => request.abort(), { once: true });
  return request.unwrap();
}

/**
 * The company events API (and the occasions the server derives from profiles), through RTK Query. As the meetings
 * client does, the calendar's reads are its own (not cached between screens, never joined to another in flight).
 */
export function eventsClient(dispatch: AppDispatch) {
  const fresh = { subscribe: false, forceRefetch: true } as const;
  let reads = 0;
  const own = <T extends object>(arg: T): T => ({ ...arg, read: ++reads });
  return {
    events: (fromUtc: string, toUtc: string, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.getCompanyEvents.initiate(own({ fromUtc, toUtc }), fresh)), signal),
    occasions: (fromUtc: string, toUtc: string, signal?: AbortSignal) =>
      bound(dispatch(portalApi.endpoints.getOccasions.initiate(own({ fromUtc, toUtc }), fresh)), signal),
    create: (request: CompanyEventWriteRequest) =>
      dispatch(portalApi.endpoints.createCompanyEvent.initiate({ companyEventWriteRequest: request })).unwrap(),
    update: (id: number, request: CompanyEventWriteRequest) =>
      dispatch(portalApi.endpoints.updateCompanyEvent.initiate({ id, companyEventWriteRequest: request })).unwrap(),
    remove: (id: number) =>
      dispatch(portalApi.endpoints.deleteCompanyEvent.initiate({ id })).unwrap(),
  };
}

export type EventsClient = ReturnType<typeof eventsClient>;

export function useEventsClient(): EventsClient {
  const dispatch = useAppDispatch();
  return useMemo(() => eventsClient(dispatch), [dispatch]);
}
