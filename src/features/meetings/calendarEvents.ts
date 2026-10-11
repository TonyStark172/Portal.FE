import { backendUrl } from "@/shared/config/backend";
import { ApiProblemError, readProblem } from "@/shared/api/problem";
import type { Meeting } from "./meetingTypes";
import { requestProtected, type SessionStore } from "@/shared/api/fetchProtected";
import { toast } from "@heroui/react";
import { getStoredLocale } from "@/shared/i18n/locale";

// Explicit tokens remain supported for standalone callers; UI passes its live session store.
export type MeetingSession = SessionStore | string | null;
const expiredSessionNotices = new WeakSet<SessionStore>();

export type MeetingEvent = {
  id: string;
  start: Date | null;
  end: Date | null;
  allDay: boolean;
  extendedProps: Partial<Meeting> & { preview?: boolean; previewInteractive?: boolean };
};
type Change = { event: MeetingEvent; revert: () => void };
type Handlers = {
  save: (event: MeetingEvent) => Promise<void>;
  onPending: (pending: boolean) => void;
  onError: (message: string | null) => void;
  onSaved: () => void;
  onSettled?: () => void;
};
export function canMovePreview(event: MeetingEvent, busy: boolean): boolean {
  return !busy && event.id.startsWith("preview-overlap-") && event.extendedProps.preview === true &&
    event.extendedProps.previewInteractive === true && !event.allDay && !!event.start && !!event.end &&
    Number.isFinite(event.start.getTime()) && Number.isFinite(event.end.getTime()) && event.end.getTime()-event.start.getTime()>=15*60000;
}
type TimeChangeOperation = "drop" | "resize";
const midnight = (date: Date) => date.getTime() % 86400000 === 0;
export function canMoveMeeting(event: MeetingEvent, userId: number | undefined, busy: boolean, operation: TimeChangeOperation = "drop"): boolean {
  const resizingAllDayInTimeGrid = operation === "resize" && event.extendedProps.isAllDay === true && !event.allDay;
  return !busy && userId !== undefined && event.extendedProps.organizerId === userId &&
    !event.extendedProps.preview && (event.allDay === !!event.extendedProps.isAllDay || resizingAllDayInTimeGrid) && !!event.start && !!event.end &&
    Number.isFinite(event.start.getTime()) && Number.isFinite(event.end.getTime()) &&
    event.end.getTime() - event.start.getTime() >= 15 * 60000 &&
    (!event.allDay || midnight(event.start) && midnight(event.end));
}
export function createTimeChangeHandler(handlers: Handlers) {
  let busy = false;
  return async (change: Change, userId: number | undefined, operation: TimeChangeOperation = "drop"): Promise<void> => {
    // Samples must never enter the save/refetch workflow, even for a malformed drop.
    if (change.event.extendedProps.preview) {
      if (!canMovePreview(change.event, busy)) change.revert();
      return;
    }
    if (!canMoveMeeting(change.event, userId, busy, operation)) {
      change.revert();
      handlers.onError(busy ? "Đang lưu thay đổi. Vui lòng đợi." : "Bạn chỉ có thể đổi lịch do mình tổ chức, với thời lượng ít nhất 15 phút và giờ cụ thể.");
      return;
    }
    busy = true;
    handlers.onPending(true);
    handlers.onError(null);
    try {
      const event = change.event;
      // The UTC calendar contains business wall-clock values, not UTC instants.
      // Keep full midnight-to-midnight spans all-day; partial spans become timed.
      // Copy instead of mutating EventApi, so revert still restores the original kind.
      const resizedAllDay = operation === "resize" && event.extendedProps.isAllDay && !event.allDay;
      const isAllDay = !!(resizedAllDay && midnight(event.start!) && midnight(event.end!));
      await handlers.save(resizedAllDay ? { ...event, id: event.id, start: event.start, end: event.end,
        allDay: isAllDay, extendedProps: { ...event.extendedProps, isAllDay } } : event);
    } catch (error) {
      change.revert();
      if (error instanceof Error && error.name === "AbortError") return;
      handlers.onError(error instanceof Error ? error.message : "Không thể cập nhật cuộc họp.");
      return;
    } finally {
      busy = false;
      handlers.onPending(false);
      handlers.onSettled?.();
    }
    // Refetch failures must not undo an update that the server has already committed.
    handlers.onSaved();
  };
}
export async function meetingRequest<T>(path: string, token: MeetingSession, init?: RequestInit): Promise<T> {
  const session = token && typeof token === "object" ? token : null;
  // One notice for all concurrent calendar/audience/mutation failures, reset after sign-in.
  if (session?.getState().session.status === "authenticated") expiredSessionNotices.delete(session);
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept-Language")) headers.set("Accept-Language", getStoredLocale());
  if (typeof token === "string") headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = token && typeof token === "object"
      ? await requestProtected(token, path, { ...init, headers })
      : await fetch(backendUrl(path), { ...init, headers });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Không kết nối được tới máy chủ. Vui lòng kiểm tra mạng và thử lại.");
  }
  if (!response.ok) {
    if (response.status === 403) throw new Error("Bạn không có quyền thay đổi cuộc họp này.");
    if (response.status === 401) {
      const message = "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
      if (session && !expiredSessionNotices.has(session)) {
        expiredSessionNotices.add(session);
        toast.danger(message);
      }
      throw new ApiProblemError({ status: 401, code: "session_expired", detail: message });
    }
    const problem = await readProblem(response);
    if (response.status === 409 && problem.code === "unknown") throw new Error("Địa điểm hoặc người tham gia đã có cuộc họp bị trùng giờ.");
    throw new ApiProblemError(problem);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
