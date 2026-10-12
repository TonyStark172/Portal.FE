"use client";
import { MeetingKindsEditor } from "./MeetingKindsEditor";
import { WorkWeekEditor } from "./WorkWeekEditor";

/** The settings tab of the meeting calendar: the organization's work week and its kinds of meeting. */
export function MeetingSettings() {
  return (
    <div className="flex flex-col gap-6">
      <WorkWeekEditor />
      <MeetingKindsEditor />
    </div>
  );
}
