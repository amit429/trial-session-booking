import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb, testDb as db } from "../helpers/db";

async function mentorAndParent() {
  const mentor = await db.mentor.create({
    data: { name: "Test Mentor", email: "m@example.com", timezone: "Asia/Kolkata", bio: "", shiftLabel: "UK shift" }
  });
  const parent = await db.parent.create({ data: { name: "P", email: "p@example.com", timezone: "America/New_York" } });
  return { mentor, parent };
}

function booking(mentorId: string, parentId: string, startIso: string, key: string, status: "CONFIRMED" | "CANCELLED" = "CONFIRMED") {
  const start = new Date(startIso);
  return db.booking.create({
    data: {
      reference: `CY-${key}`,
      parentId,
      mentorId,
      childName: "Sam",
      childGrade: 4,
      subject: "CODING",
      startUtc: start,
      endUtc: new Date(start.getTime() + 3_600_000),
      mentorLocalDate: new Date("2026-10-21T00:00:00Z"),
      parentTimezone: "America/New_York",
      mentorTimezone: "Asia/Kolkata",
      meetingUrl: "https://x",
      idempotencyKey: key,
      status
    }
  });
}

describe("database constraints", () => {
  beforeEach(() => resetDb());
  afterAll(() => db.$disconnect());

  it("rejects two confirmed bookings that overlap for the same mentor", async () => {
    const { mentor, parent } = await mentorAndParent();
    await booking(mentor.id, parent.id, "2026-10-20T19:00:00Z", "A");
    await expect(booking(mentor.id, parent.id, "2026-10-20T19:30:00Z", "B")).rejects.toThrow(/booking_no_overlap_per_mentor|23P01/);
  });

  it("allows back-to-back bookings and overlaps with cancelled ones", async () => {
    const { mentor, parent } = await mentorAndParent();
    await booking(mentor.id, parent.id, "2026-10-20T19:00:00Z", "A");
    await booking(mentor.id, parent.id, "2026-10-20T20:00:00Z", "B");
    await booking(mentor.id, parent.id, "2026-10-20T19:30:00Z", "C", "CANCELLED");
    expect(await db.booking.count()).toBe(3);
  });

  it("rejects an invalid grade and shift bounds", async () => {
    const { mentor } = await mentorAndParent();
    await expect(
      db.availabilityRule.create({ data: { mentorId: mentor.id, weekday: 8, startMinute: 0, endMinute: 60 } })
    ).rejects.toThrow();
    await expect(
      db.availabilityRule.create({ data: { mentorId: mentor.id, weekday: 1, startMinute: 600, endMinute: 500 } })
    ).rejects.toThrow();
  });
});
