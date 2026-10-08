/**
 * Demo data (Technical Design §15): admin, 10 mentors on region-aligned shifts, and bookings that put
 * every edge state on screen. Bookings go through BookingService, so all invariants hold.
 * Re-running replaces all data in the development database.
 */
import { randomUUID } from "node:crypto";
import { addDays, localDate, zonedTime } from "@shared";
import { FixedClock } from "@/core/clock";
import { loadConfig } from "@/core/config";
import { buildContainer } from "@/container";
import { createDb } from "@/core/db";
import { MENTOR_SEED, SHIFTS, mentorEmail, seedRules } from "@/data/seed-mentors";
import { AppError } from "@/http/errors";
import { hashPassword } from "@/modules/auth/passwords";

const NY = "America/New_York";
const LDN = "Europe/London";
const LA = "America/Los_Angeles";
const IST = "Asia/Kolkata";

const FIRST = [
  "Sarah",
  "Michael",
  "Priyanka",
  "James",
  "Olivia",
  "Daniel",
  "Hannah",
  "Marcus",
  "Grace",
  "Tom",
  "Aisha",
  "Ryan",
  "Chloe",
  "Ben",
  "Fatima",
  "Lucas",
  "Megan",
  "Omar",
  "Rachel",
  "Sean"
];
const LAST = [
  "Miller",
  "Johnson",
  "Shah",
  "Walker",
  "Kim",
  "Murphy",
  "Brooks",
  "Nguyen",
  "Hughes",
  "Khan",
  "Foster",
  "Evans",
  "Carter",
  "Garcia",
  "Byrne",
  "Cohen",
  "Price"
];
const KIDS = ["Ava", "Leo", "Zara", "Noah", "Isla", "Kai", "Maya", "Eli", "Ruby", "Finn", "Nora", "Arlo"];

async function main() {
  const config = loadConfig();
  if (config.env === "production") throw new Error("Refusing to seed a production database.");
  const db = createDb();
  const clock = new FixedClock(new Date());
  const c = buildContainer({ db, clock, config });
  const realNow = clock.now();

  await db.$executeRawUnsafe(
    'TRUNCATE "OutboxMessage", "Booking", "AuthToken", "Session", "AdminUser", "Parent", "AvailabilityRule", "Mentor" CASCADE'
  );
  await c.adminAuth.ensureAdmin();

  const mentors = [];
  for (const m of MENTOR_SEED) {
    mentors.push(
      await db.mentor.create({
        data: {
          name: m.name,
          email: mentorEmail(m.name),
          timezone: IST,
          bio: m.bio,
          shiftLabel: SHIFTS[m.shift].label,
          rules: { create: seedRules(m.shift, m.off) }
        }
      })
    );
  }

  let n = 0;
  const person = () => {
    n++;
    const f = FIRST[n % FIRST.length],
      l = LAST[(n * 7) % LAST.length];
    return { name: `${f} ${l}`, email: `${f}.${l}${n}`.toLowerCase() + "@example.com" };
  };
  const book = async (startUtc: Date, timezone: string, who = person(), child = KIDS[n % KIDS.length]) => {
    try {
      return await c.bookings.create(
        {
          parent: { name: who.name, email: who.email, phone: undefined },
          child: { name: child, grade: 2 + (n % 8) },
          subject: n % 2 ? "CODING" : "MATH",
          startUtc: startUtc.toISOString(),
          timezone
        },
        randomUUID()
      );
    } catch (e) {
      if (e instanceof AppError) return null;
      throw e;
    }
  };
  const openSlots = async (tz: string, date: string) =>
    (await c.slots.getDays(tz, date, 1))[0]?.slots.filter(s => s.status === "OPEN") ?? [];
  const today = localDate(realNow, NY);
  const report: string[] = [];

  // S1 · a UK-shift mentor already at 2/2 on tomorrow's India date.
  const tIst = addDays(localDate(realNow, IST), 1);
  const wd = zonedTime(tIst, 720, IST).weekday;
  const s1 = mentors.find((_, i) => MENTOR_SEED[i].shift === "UK" && MENTOR_SEED[i].off !== wd);
  if (!s1) throw new Error("Seed data has no UK-shift mentor working tomorrow");
  for (const minutes of [19 * 60, 21 * 60]) {
    const start = zonedTime(tIst, minutes, IST).toJSDate();
    const who = person();
    const parent = await db.parent.create({ data: { name: who.name, email: who.email, timezone: LDN } });
    await db.booking.create({
      data: {
        reference: `CY-S1${minutes === 1140 ? "AAA" : "BBB"}`,
        parentId: parent.id,
        mentorId: s1.id,
        childName: "Oliver",
        childGrade: 5,
        subject: "CODING",
        startUtc: start,
        endUtc: new Date(start.getTime() + 3_600_000),
        mentorLocalDate: new Date(`${tIst}T00:00:00Z`),
        parentTimezone: LDN,
        mentorTimezone: IST,
        meetingUrl: `${config.meetingBaseUrl}/CY-S1-${minutes}`,
        idempotencyKey: randomUUID()
      }
    });
  }
  report.push(`S1 mentor at 2/2: ${s1.name} on ${tIst} (India date)`);

  // S2 · one slot full across every mentor on shift: day + 2, 9:30 AM New York.
  const s2 = zonedTime(addDays(today, 2), 9 * 60 + 30, NY).toJSDate();
  let s2Count = 0;
  while ((await book(s2, NY)) && s2Count < 10) s2Count++;
  report.push(`S2 full slot: ${addDays(today, 2)} 9:30 AM New York (${s2Count} bookings)`);

  // S3 · a whole New York day fully booked: day + 4.
  const d3 = addDays(today, 4);
  for (let guard = 0; guard < 40; guard++) {
    const open = await openSlots(NY, d3);
    if (!open.length) break;
    await book(open[0].startUtc, NY);
  }
  report.push(`S3 full day: ${d3} for New York`);

  // Background bookings so the calendar and admin look lived-in.
  for (let i = 0; i < 9; i++) {
    const tz = i % 3 ? NY : LDN;
    const open = await openSlots(tz, addDays(localDate(realNow, tz), 1 + ((i * 3) % 12)));
    if (open.length) await book(open[(i * 7) % open.length].startUtc, tz);
  }

  // S4 · a cancelled booking.
  const s4slot = (await openSlots(NY, addDays(today, 5)))[0];
  if (s4slot) {
    const b = await book(s4slot.startUtc, NY, { name: "Chris Patel", email: "cancelled.parent@example.com" }, "Mia");
    if (b) {
      await c.bookings.cancel(b.reference, { isAdmin: true }, "PARENT");
      report.push(`S4 cancelled: ${b.reference}`);
    }
  }

  // S5 · verified demo parent (London) with an upcoming and a past booking.
  const demo = { name: "Emma Clarke", email: "demo.parent@example.com" };
  // Past first: from "4 days ago" the later upcoming trial would count as the one active trial.
  clock.set(zonedTime(addDays(localDate(realNow, LDN), -4), 6 * 60, LDN).toJSDate()); // 06:00 London, 4 days ago
  const past = await openSlots(LDN, localDate(clock.now(), LDN));
  const lastPast = past.at(-1);
  if (lastPast) await book(lastPast.startUtc, LDN, demo, "Freddie");
  clock.set(realNow);
  const upcoming = await openSlots(LDN, addDays(localDate(realNow, LDN), 3));
  if (upcoming.length) await book(upcoming[Math.floor(upcoming.length / 2)].startUtc, LDN, demo, "Freddie");
  await db.parent.update({
    where: { email: demo.email },
    data: { passwordHash: await hashPassword("Parent123!"), emailVerifiedAt: realNow, phone: "+44 7700 900123" }
  });
  report.push("S5 verified parent: demo.parent@example.com / Parent123!");

  // S6 · pending parent: booked as a guest, signed up, not verified yet.
  const s6slot = (await openSlots(NY, addDays(today, 6)))[0];
  if (s6slot) await book(s6slot.startUtc, NY, { name: "Jordan Lee", email: "pending.parent@example.com" }, "Sam");
  await c.parentAuth.signup("Jordan Lee", "pending.parent@example.com", "Pending123!");
  report.push("S6 pending parent: pending.parent@example.com / Pending123! (verify link in the outbox)");

  // S7 · guest only (Los Angeles).
  const s7slot = (await openSlots(LA, addDays(localDate(realNow, LA), 7)))[0];
  if (s7slot) {
    const b = await book(s7slot.startUtc, LA, { name: "Alex Rivera", email: "guest.parent@example.com" }, "Luna");
    if (b) report.push(`S7 guest booking: ${b.manageUrl}`);
  }

  const total = await db.booking.count({ where: { status: "CONFIRMED" } });
  console.log(`\nSeeded ${mentors.length} mentors and ${total} confirmed bookings.\n`);
  console.log(`Admin:  ${config.admin.email} / ${config.admin.password}  →  ${config.appBaseUrl}/admin`);
  for (const line of report) console.log(`  ${line}`);
  console.log("");
  await db.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
