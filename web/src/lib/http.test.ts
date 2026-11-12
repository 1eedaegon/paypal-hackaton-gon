import { afterEach, describe, expect, test, vi } from "vitest";
import { describeError } from "./errors";
import { ApiError, request, setUnauthorizedHandler, unwrapEnvelope } from "./http";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function captureError(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
  }
  throw new Error("expected an ApiError to be thrown");
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe("unwrapEnvelope", () => {
  test("returns data from a success envelope", () => {
    expect(unwrapEnvelope<{ n: number }>({ ok: true, data: { n: 1 } }, 200)).toEqual({ n: 1 });
  });

  test("throws an ApiError carrying the server code, message and HTTP status", () => {
    const body = { ok: false, error: { code: "conflict", message: "Sample data already loaded" } };
    const error = captureError(() => unwrapEnvelope(body, 409));
    expect(error.code).toBe("conflict");
    expect(error.message).toBe("Sample data already loaded");
    expect(error.status).toBe(409);
  });

  test("maps an unknown error code to internal", () => {
    const error = captureError(() => unwrapEnvelope({ ok: false, error: { code: "weird", message: "x" } }, 500));
    expect(error.code).toBe("internal");
  });

  test("treats a body that is not an envelope as an error instead of returning it", () => {
    expect(captureError(() => unwrapEnvelope(null, 502)).code).toBe("internal");
    expect(captureError(() => unwrapEnvelope("<html>", 401)).code).toBe("unauthorized");
  });
});

describe("request", () => {
  test("sends JSON with the session cookie and resolves with the unwrapped data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, data: { user: { id: "u1" } } }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const data = await request<{ user: { id: string } }>("POST", "/api/auth/login", { email: "a@b.co" });

    expect(data.user.id).toBe("u1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.co" }),
      }),
    );
  });

  test("notifies the unauthorized handler on a 401 and still rejects", async () => {
    const body = { ok: false, error: { code: "unauthorized", message: "Please log in" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(body, 401)));
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(request("GET", "/api/dashboard")).rejects.toMatchObject({ code: "unauthorized", status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  test("reports a network error when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(request("GET", "/api/dashboard")).rejects.toMatchObject({ code: "network", status: 0 });
  });
});

describe("describeError", () => {
  test("shows the server message for ordinary API errors", () => {
    expect(describeError(new ApiError("upstream_error", "PayPal is not responding", 502))).toBe(
      "PayPal is not responding",
    );
  });

  test("explains a used-up agent quota in friendly terms", () => {
    expect(describeError(new ApiError("quota_exceeded", "quota", 429))).toMatch(/resets tomorrow/);
  });
});
