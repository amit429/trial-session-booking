import type { Db } from "@/core/db";
import { MENTOR_SEED, SHIFTS, mentorEmail, seedRules } from "@/data/seed-mentors";

/** Create the 10 seed mentors. `allWeek` drops each mentor's day off. */
export async function seedMentors(db: Db, opts: { allWeek?: boolean; only?: number[] } = {}) {
  const list = MENTOR_SEED.filter((_, i) => !opts.only || opts.only.includes(i));
  const out = [];
  for (const m of list) {
    out.push(
      await db.mentor.create({
        data: {
          name: m.name,
          email: mentorEmail(m.name),
          timezone: "Asia/Kolkata",
          bio: m.bio,
          shiftLabel: SHIFTS[m.shift].label,
          rules: { create: seedRules(m.shift, opts.allWeek ? 0 : m.off) }
        }
      })
    );
  }
  return out;
}
