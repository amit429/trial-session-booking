import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireParent } from "@/components/guards/route-guards";
import { mockApi } from "@/test/mockApi";
import { LoginPage } from "../pages/LoginPage";
import { MyBookingsPage } from "@/features/my-bookings/pages/MyBookingsPage";

const parent = { id: "p1", name: "Emma Clarke", email: "demo.parent@example.com", timezone: "Europe/London", status: "VERIFIED" };

describe("parent sign-in", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lands on My bookings after the first successful sign-in", async () => {
    let signedIn = false;
    mockApi({
      "GET /auth/me": async () => { await new Promise(r => setTimeout(r, 60)); return { parent: signedIn ? parent : null, admin: null }; },
      "POST /auth/parent/login": () => { signedIn = true; return { parent }; },
      "GET /me/bookings": () => []
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/my-bookings" element={<RequireParent><MyBookingsPage /></RequireParent>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    await userEvent.type(await screen.findByLabelText("Email"), parent.email);
    await userEvent.type(screen.getByLabelText("Password"), "Parent123!");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "My bookings" })).toBeInTheDocument();
  });
});
