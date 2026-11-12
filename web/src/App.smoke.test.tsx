import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function stubSignedOut() {
  const body = { ok: false, error: { code: "unauthorized", message: "Please log in." } };
  const respond = () => Promise.resolve(new Response(JSON.stringify(body), { status: 401 }));
  vi.stubGlobal("fetch", vi.fn(respond));
}

describe("public routes render for a signed-out visitor", () => {
  beforeEach(() => {
    stubSignedOut();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("the landing page shows the headline, both calls to action and the hackathon footer", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: /get paid on time/i })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /get started free/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /see how it works/i })).toBeTruthy();
    expect(screen.getByText(/Built on PayPal Invoicing, PayPal Webhooks, Google Gemini\./)).toBeTruthy();
    expect(screen.getByText(/Built for the PayPal AI Hackathon/)).toBeTruthy();
  });

  test("the login page has labelled email and password fields", async () => {
    renderAt("/login");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log in" })).toBeTruthy();
  });

  test("the signup page asks for name, email and password", async () => {
    renderAt("/signup");
    expect(await screen.findByRole("heading", { name: /create your account/i })).toBeTruthy();
    expect(screen.getByLabelText("Your name")).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  test("an unknown route shows a 404 with a link home", async () => {
    renderAt("/nope");
    expect(await screen.findByRole("heading", { name: /isn't on the books/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /back to home/i }).getAttribute("href")).toBe("/");
  });

  test("the app route sends a visitor without a session to the login page", async () => {
    renderAt("/app");
    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeTruthy();
  });
});
