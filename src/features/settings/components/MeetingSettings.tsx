"use client";
import { MeetingKindsEditor } from "./MeetingKindsEditor";

/** The settings tab of the meeting calendar: the organization's kinds of meeting (its work week is under Administration → Organization). */
export function MeetingSettings() {
  return (
    <div className="flex flex-col gap-6">
      <MeetingKindsEditor />
    </div>
  );
}
