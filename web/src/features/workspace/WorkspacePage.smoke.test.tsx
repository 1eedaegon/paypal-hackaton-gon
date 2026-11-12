import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "../../App";
import type { Dashboard } from "../../lib/types";
import { makeAction, makeInvoice } from "../../test/fixtures";

const dashboard: Dashboard = {
  summary: {
    outstanding_total: "1360.00",
    overdue_total: "860.00",
    paid_30d_total: "1200.00",
    counts: { draft: 1, sent: 2, overdue: 1, paid: 1 },
  },
  invoices: [
    makeInvoice({ id: "paid", number: "0003", status: "paid", recipient_name: "Lumen Labs", total: "1200.00" }),
    makeInvoice({ id: "draft", number: null, status: "draft", recipient_name: "Northwind Studio", pay_url: null }),
    makeInvoice({ id: "late", number: "0042", recipient_name: "Harbor & Co.", total: "860.00", is_overdue: true, days_overdue: 9 }),
  ],
  pending_actions: [makeAction({ invoice_id: "late" })],
  usage: { agent_calls_today: 3, agent_daily_limit: 20 },
};

const routes: Record<string, unknown> = {
  "/api/auth/me": { user: { id: "u1", email: "dae@example.com", name: "Dae" } },
  "/api/dashboard": dashboard,
};

function stubSignedIn() {
  const respond = (input: RequestInfo | URL) => {
    const data = routes[String(input)];
    const body = data ? { ok: true, data } : { ok: false, error: { code: "not_found", message: "Not found" } };
    return Promise.resolve(new Response(JSON.stringify(body), { status: data ? 200 : 404 }));
  };
  vi.stubGlobal("fetch", vi.fn(respond));
}

describe("workspace for a signed-in user", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    stubSignedIn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("shows the summary tiles, the draft awaiting approval, and invoices with overdue first", async () => {
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Outstanding")).toBeTruthy();
    expect(screen.getByText("$1,360.00")).toBeTruthy();
    expect(screen.getByText("3 / 20")).toBeTruthy();
    expect(screen.getByRole("article", { name: "Draft invoice" })).toBeTruthy();
    expect(screen.getByDisplayValue("Northwind Studio")).toBeTruthy();

    const rows = screen.getAllByRole("button", { name: /Harbor & Co\.|Lumen Labs/ });
    expect(rows[0]?.getAttribute("aria-label")).toBe("Harbor & Co., Invoice 0042, $860.00, due Nov 20, Overdue 9d, No reminders");
    expect(rows[1]?.getAttribute("aria-label")).toContain("Lumen Labs, Invoice 0003, $1,200.00");
    expect(rows[1]?.getAttribute("aria-label")).toContain("Paid");

    expect(screen.getByRole("tab", { name: "Approvals, 1 waiting for approval" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Run collection review" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Paste a client message or tell Duely what to bill...")).toBeTruthy();
  });
});
