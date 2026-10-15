/**
 * Error body returned by Portal.BE for every failed request (RFC 9110 problem details).
 * `code` is stable and meant for programs; `detail` is a Vietnamese message for people.
 */
export type ApiProblem = {
  status: number;
  title?: string;
  detail?: string;
  code: string;
  /** Validation messages per field, keyed by the back end's (PascalCase) property names. */
  errors?: Record<string, string[]>;
};

export const ErrorCodes = {
  validationFailed: "validation_failed",
  unauthenticated: "unauthenticated",
  tokenExpired: "token_expired",
  sessionExpired: "session_expired",
  invalidCredentials: "invalid_credentials",
  accountDisabled: "account_disabled",
  accountLocked: "account_locked",
  forbidden: "forbidden",
  passwordChangeRequired: "password_change_required",
  notFound: "not_found",
  conflict: "conflict",
  invalidCode: "invalid_code",
  codeExpired: "code_expired",
  tooManyRequests: "too_many_requests",
  network: "network_error",
} as const;

const NETWORK_PROBLEM: ApiProblem = {
  status: 0,
  code: ErrorCodes.network,
  detail: translate("common.networkError", getStoredLocale()),
};

const isProblemBody = (value: unknown): value is Omit<ApiProblem, "status"> & { status?: number } =>
  typeof value === "object" && value !== null && "code" in value;

/** Turns any RTK Query / fetch error (including what `unwrap()` throws) into an {@link ApiProblem}. */
export function toApiProblem(error: unknown): ApiProblem {
  if (typeof error !== "object" || error === null || !("status" in error)) return NETWORK_PROBLEM;

  const { status, data, originalStatus } = error as { status: unknown; data?: unknown; originalStatus?: unknown };
  if (typeof status === "number" && isProblemBody(data)) {
    return { ...data, status };
  }

  // A response that is not a problem (e.g. a proxy's HTML error page: RTK's "PARSING_ERROR" with its originalStatus)
  // is a server error, not a lost connection.
  const httpStatus = typeof status === "number" ? status : typeof originalStatus === "number" ? originalStatus : null;
  return httpStatus !== null
    ? { status: httpStatus, code: "unknown", detail: translate("common.genericError", getStoredLocale()) }
    : NETWORK_PROBLEM;
}

/** Reads a problem from a raw fetch Response (used outside RTK Query). */
export async function readProblem(response: Response): Promise<ApiProblem> {
  const body: unknown = await response.json().catch(() => null);
  return isProblemBody(body)
    ? { ...body, status: response.status }
    : { status: response.status, code: "unknown", detail: translate("common.genericError", getStoredLocale()) };
}

/**
 * Maps validation errors to form field names: the back end reports "UserName",
 * the form field is "userName".
 */
export function toFieldErrors(problem: ApiProblem): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(problem.errors ?? {}).map(([field, messages]) => [
      field.charAt(0).toLowerCase() + field.slice(1),
      messages,
    ]),
  );
}

export class ApiProblemError extends Error {
  constructor(readonly problem: ApiProblem) {
    super(problem.detail ?? problem.code);
  }
}
import { getStoredLocale, translate } from "@/shared/i18n/locale";

