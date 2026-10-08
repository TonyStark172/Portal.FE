import type { Gender } from "@/shared/api/generated/portalApi";

/** Only male and female are recorded; a profile may leave the gender empty. */
export const genderLabels: Record<NonNullable<Gender>, string> = { Male: "Nam", Female: "Nữ" };
