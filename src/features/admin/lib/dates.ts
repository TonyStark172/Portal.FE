const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A day as an `<input type="date">` takes and the API reads it ("2026-10-15"), in the user's own time zone. Not
 * `toISOString().slice(0, 10)`: that is the UTC day, which for someone in Vietnam is still yesterday until 07:00.
 */
export const todayAsDateInput = (now: Date = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
