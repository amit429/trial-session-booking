import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFile } from "@/modules/bookings/calendar";

const booking = {
  reference: "CY-ABC234",
  startUtc: new Date("2026-10-21T19:00:00Z"),
  endUtc: new Date("2026-10-21T20:00:00Z"),
  subject: "CODING",
  childName: "Sam; Jr, II",
  meetingUrl: "https://meet.example/x",
  mentorName: "Vikram Nair"
};

describe("calendar exports", () => {
  it("escapes RFC 5545 special characters and uses UTC times", () => {
    const ics = icsFile(booking, new Date("2026-10-20T00:00:00Z"));
    expect(ics).toContain("SUMMARY:Free Coding trial for Sam\\; Jr\\, II");
    expect(ics).toContain("DTSTART:20261021T190000Z");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("builds a Google Calendar link with readable UTC dates", () => {
    expect(googleCalendarUrl(booking)).toContain("dates=20261021T190000Z/20261021T200000Z");
  });
});
