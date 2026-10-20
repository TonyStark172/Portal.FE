import type {
  CompanyEventCategory,
  CompanyEventDto,
  CompanyEventWriteRequest,
  OccasionDto,
  PublicHoliday,
} from "@/shared/api/generated/portalApi";

// The API's own types: a company event (a year end party, a sport day, team building, training…) and an occasion the
// server derives on its own (a public holiday, the company's birthday, a person's birthday).
export type CompanyEvent = CompanyEventDto;
export type Occasion = OccasionDto;
export type OccasionKind = Occasion["kind"];
export type HolidayOccasion = Extract<Occasion, { kind: "Holiday" }>;
export type CompanyBirthday = Extract<Occasion, { kind: "CompanyAnniversary" }>;
export type BirthdayOccasion = Extract<Occasion, { kind: "Birthday" }>;
export type { CompanyEventCategory, CompanyEventWriteRequest, PublicHoliday };

/** The categories, in the order a form lists them; each has its colour (globals.css --event-…). */
export const eventCategories: CompanyEventCategory[] = ["Party", "Sports", "TeamBuilding", "Training", "Other"];
/** The category a new event starts with. */
export const defaultEventCategory: CompanyEventCategory = "Other";

/** Who an event is for: the whole company, or chosen departments (and their sub-departments, on the server). */
export type EventAudience = "company" | "departments";

/**
 * The event form. `start`/`end` are business-time inputs ("yyyy-mm-ddThh:mm", or dates when all day, the end
 * inclusive), as the meeting form has them.
 */
export type CompanyEventFormValue = {
  title: string;
  category: CompanyEventCategory;
  isAllDay: boolean;
  start: string;
  end: string;
  location: string;
  description: string;
  audience: EventAudience;
  departmentIds: number[];
  /** The event being edited (null: a new one). */
  editing: CompanyEvent | null;
};
