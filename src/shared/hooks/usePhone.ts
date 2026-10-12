"use client";

import { readBreakpoint, useBreakpoint } from "./breakpoints";

/** Whether the screen is a phone's (breakpoints.ts), upright or sideways. */
export const readPhone = () => readBreakpoint() === "phone";

/** Whether the screen is a phone's; false on the server and while hydrating. */
export const usePhone = () => useBreakpoint() === "phone";
