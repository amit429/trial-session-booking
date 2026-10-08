import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import { BookingPage } from "../pages/BookingPage";

const booking = (parentAccount: string) => ({
  reference: "CY-ABC234",
  status: "CONFIRMED",
  startUtc: "2099-10-21T19:00:00.000Z",
  endUtc: "2099-10-21T20:00:00.000Z",
  parentTimezone: "America/New_York",
  mentorTimezone: "Asia/Kolkata",
  meetingUrl: "https://meet.example/x",
  manageUrl: "http://localhost/booking/CY-ABC234?token=t",
  googleCalendarUrl: "https://calendar.google.com/x",
  subject: "CODING",
  child: { name: "Sam", grade: 4 },
  parent: { name: "Jane Doe", email: "jane@example.com" },
  parentAccount,
  mentor: { id: "m1", name: "Vikram Nair", bio: "bio", shiftLabel: "US-East shift", timezone: "Asia/Kolkata" },
  cancelledAt: null,
  cancelledBy: null,
  createdAt: "2099-10-01T00:00:00.000Z"
});

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/booking/:reference" element={<BookingPage />} />
          <Route path="/admin/bookings/:reference" element={<h1>Admin booking view</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("booking page audience", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("offers account creation to a guest holding the manage link", async () => {
    mockApi({ "GET /auth/me": () => ({ parent: null, admin: null }), "GET /bookings/CY-ABC234": () => booking("GUEST") });
    renderAt("/booking/CY-ABC234?token=t");
    expect(await screen.findByText("See all your bookings in one place")).toBeInTheDocument();
  });

  it("doesn't offer account creation when that email already has an account", async () => {
    mockApi({ "GET /auth/me": () => ({ parent: null, admin: null }), "GET /bookings/CY-ABC234": () => booking("VERIFIED") });
    renderAt("/booking/CY-ABC234?token=t");
    expect(await screen.findByText("Your trial is booked")).toBeInTheDocument();
    expect(screen.queryByText("See all your bookings in one place")).toBeNull();
  });

  it("sends a signed-in admin to the admin booking view", async () => {
    mockApi({
      "GET /auth/me": () => ({ parent: null, admin: { id: "a", name: "Ops Admin", email: "admin@trialdesk.example" } }),
      "GET /bookings/CY-ABC234": () => booking("GUEST")
    });
    renderAt("/booking/CY-ABC234");
    expect(await screen.findByRole("heading", { name: "Admin booking view" })).toBeInTheDocument();
  });

  it("never shows the account prompt to an admin, even with a parent's link", async () => {
    mockApi({
      "GET /auth/me": () => ({ parent: null, admin: { id: "a", name: "Ops Admin", email: "admin@trialdesk.example" } }),
      "GET /bookings/CY-ABC234": () => booking("GUEST")
    });
    renderAt("/booking/CY-ABC234?token=t");
    expect(await screen.findByText(/signed in as admin/i)).toBeInTheDocument();
    expect(screen.queryByText("See all your bookings in one place")).toBeNull();
  });
});
