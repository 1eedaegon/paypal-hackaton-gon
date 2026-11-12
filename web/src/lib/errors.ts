import { ApiError } from "./http";

const QUOTA_MESSAGE =
  "You've used all of today's agent calls. The limit resets tomorrow. Until then you can still edit, approve and send everything by hand.";
const RATE_LIMIT_MESSAGE = "That was a little too fast. Give it a few seconds and try again.";
const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/** The text to show a person for any thrown value. Server messages are safe to show by contract. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message !== "" ? error.message : FALLBACK_MESSAGE;
  }
  if (error.code === "quota_exceeded") {
    return QUOTA_MESSAGE;
  }
  if (error.code === "rate_limited" && error.message === "") {
    return RATE_LIMIT_MESSAGE;
  }
  return error.message || FALLBACK_MESSAGE;
}

export function isApiError(error: unknown, code?: ApiError["code"]): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}
