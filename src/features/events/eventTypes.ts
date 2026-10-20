import type {
  CompanyEventCategory,
  CompanyEventDto,
  CompanyEventWriteRequest,
  OccasionDto,
  OccasionKind,
} from "@/shared/api/generated/portalApi";

// The API's own types: a company event (training, team building, a deadline…) and an occasion the server derives
// from people's profiles (a birthday, a work anniversary).
export type CompanyEvent = CompanyEventDto;
export type Occasion = OccasionDto;
export type { CompanyEventCategory, CompanyEventWriteRequest, OccasionKind };

/** The categories, in the order a form lists them; each has its colour (globals.css --event-…). */
export const eventCategories: CompanyEventCategory[] = ["General", "Training", "TeamBuilding", "Deadline", "Celebration"];

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
