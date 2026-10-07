import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SuggestionsResponse } from "@trial/shared";
import { describe, expect, it, vi } from "vitest";
import { Suggestions } from "../Suggestions";
import { validateBooking } from "../validation";

const NY = "America/New_York";
const sg = (strategy: SuggestionsResponse["strategy"], n = 2): SuggestionsResponse => ({
  strategy,
  requested: { date: "2026-10-31", time: "09:00", timezone: NY },
  suggestions: Array.from({ length: n }, (_, i) => ({ startUtc: `2026-10-31T1${3 + i}:30:00.000Z`, endUtc: "x", status: "OPEN", availableMentors: i ? 3 : 1 })),
  notes: []
});

describe("Suggestions", () => {
  it("explains a taken time and lists same-day options in the parent's zone", async () => {
    const onPick = vi.fn();
    render(<Suggestions tz={NY} data={sg("SAME_DAY")} onPick={onPick} />);
    expect(screen.getByText("9:00 AM is taken")).toBeInTheDocument();
    expect(screen.getByText(/These times that day are open/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /9:30 AM EDT/ }));
    expect(onPick).toHaveBeenCalledWith("2026-10-31T13:30:00.000Z");
    expect(screen.getByText(/last spot/)).toBeInTheDocument();
  });

  it("leads with the race message when the booking was just taken", () => {
    render(<Suggestions tz={NY} data={sg("SAME_TIME")} lead="That time was just booked" onPick={() => {}} />);
    expect(screen.getByText("That time was just booked")).toBeInTheDocument();
    expect(screen.getByText(/is fully booked/)).toBeInTheDocument();
  });

  it("shows the fully booked state when nothing is open", () => {
    render(<Suggestions tz={NY} data={sg("NONE", 0)} onPick={() => {}} />);
    expect(screen.getByText("We're fully booked for the next two weeks")).toBeInTheDocument();
  });
});

describe("validateBooking", () => {
  it("maps shared schema messages onto form fields", () => {
    const r = validateBooking({ name: "", email: "nope", phone: "", child: "", grade: "", subject: "" }, "2026-10-21T19:00:00.000Z", NY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toMatchObject({
      name: "Please enter your name",
      email: "Please enter a valid email",
      child: "Please enter your child's name",
      grade: "Choose a grade between 1 and 12",
      subject: "Choose a subject"
    });
  });
  it("produces the API body when valid", () => {
    const r = validateBooking({ name: "Jane Doe", email: " Jane@Example.com", phone: "", child: "Sam", grade: "4", subject: "CODING" }, "2026-10-21T19:00:00.000Z", NY);
    expect(r).toMatchObject({ ok: true, body: { parent: { email: "jane@example.com" }, child: { grade: 4 }, subject: "CODING" } });
  });
});
