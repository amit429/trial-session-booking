import { localDate, localDayWindow } from "@shared";
import { availableMentorsAt, type EngineBooking, type EngineConfig, type EngineMentor } from "./slotEngine";

type Context = { mentors: EngineMentor[]; bookings: EngineBooking[]; config: EngineConfig; now: Date };

/**
 * Order candidate mentors for a slot (Technical Design §9.2):
 * 1. fewest confirmed trials on that IST date (spread load),
 * 2. fewest other open slots that date (keep flexible mentors free for times only they can cover),
 * 3. id (deterministic).
 */
export function rankMentors(candidates: EngineMentor[], start: Date, ctx: Context): EngineMentor[] {
  const step = ctx.config.stepMinutes * 60_000;
  const earliest = ctx.now.getTime() + ctx.config.minNoticeMinutes * 60_000;
  const scored = candidates.map(m => {
    const date = localDate(start, m.timezone);
    const load = ctx.bookings.filter(b => b.mentorId === m.id && b.mentorLocalDate === date).length;
    const day = localDayWindow(date, m.timezone);
    let other = 0;
    for (let t = day.start.getTime(); t < day.end.getTime(); t += step) {
      if (t === start.getTime() || t < earliest) continue;
      if (availableMentorsAt(new Date(t), [m], ctx.bookings, ctx.config).length) other++;
    }
    return { m, load, other };
  });
  return scored.sort((a, b) => a.load - b.load || a.other - b.other || a.m.id.localeCompare(b.m.id)).map(x => x.m);
}
