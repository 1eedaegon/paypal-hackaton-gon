// Fetch layer: unwraps the { ok, data, error } envelope and throws a typed ApiError.

export type ApiErrorCode =
  | "invalid_input"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "quota_exceeded"
  | "rate_limited"
  | "upstream_error"
  | "internal"
  | "network";

const KNOWN_CODES: readonly string[] = [
  "invalid_input",
  "unauthorized",
  "not_found",
  "conflict",
  "quota_exceeded",
  "rate_limited",
  "upstream_error",
  "internal",
];

const UNREACHABLE_MESSAGE = "Can't reach the Duely server. Check your connection and try again.";
const MALFORMED_MESSAGE = "The server sent a response Duely could not read. Please try again.";
const HTTP_UNAUTHORIZED = 401;

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toErrorCode(code: unknown): ApiErrorCode {
  return typeof code === "string" && KNOWN_CODES.includes(code) ? (code as ApiErrorCode) : "internal";
}

/** Turns a parsed response body into data, or throws ApiError. Pure, so it is unit tested. */
export function unwrapEnvelope<T>(body: unknown, status: number): T {
  if (!isRecord(body) || typeof body.ok !== "boolean") {
    throw new ApiError(status === HTTP_UNAUTHORIZED ? "unauthorized" : "internal", MALFORMED_MESSAGE, status);
  }
  if (body.ok) {
    return body.data as T;
  }
  const error = isRecord(body.error) ? body.error : {};
  const message = typeof error.message === "string" && error.message !== "" ? error.message : MALFORMED_MESSAGE;
  throw new ApiError(toErrorCode(error.code), message, status);
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** The auth layer registers this so any 401 clears the session and routes to /login. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const hasBody = body !== undefined;
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: hasBody ? { "Content-Type": "application/json" } : undefined,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("network", UNREACHABLE_MESSAGE, 0);
  }
  try {
    return unwrapEnvelope<T>(await readJson(response), response.status);
  } catch (error) {
    if (error instanceof ApiError && error.status === HTTP_UNAUTHORIZED) {
      unauthorizedHandler?.();
    }
    throw error;
  }
}
