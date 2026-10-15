import { ErrorCodes, toFieldErrors, type ApiProblem } from "@/shared/api/problem";

/**
 * Splits the validation errors of a refusal into what a dialog can show under its fields and what it cannot.
 * `fieldErrors` holds the errors on the `shown` keys (the form's own camelCase spelling, as {@link toFieldErrors} gives
 * them); `leftover` holds the messages of every other key (a hidden field, a list such as the roles), so the dialog can
 * show them as they are instead of the server's generic "check the fields marked" with nothing marked.
 * A problem that is not a validation failure (or has no messages) gives both empty: the caller then uses its `detail`.
 */
export function splitValidationErrors(
  problem: ApiProblem,
  shown: readonly string[],
): { fieldErrors: Record<string, string[]>; leftover: string[] } {
  const fieldErrors: Record<string, string[]> = {};
  const leftover: string[] = [];
  if (problem.code !== ErrorCodes.validationFailed) return { fieldErrors, leftover };

  for (const [field, messages] of Object.entries(toFieldErrors(problem))) {
    if (shown.includes(field)) fieldErrors[field] = messages;
    else leftover.push(...messages);
  }
  return { fieldErrors, leftover };
}
