import {
  DAY_MS,
  formatClockMinutes,
  formatDay,
  localClockMinutes,
  type SuggestionNote,
  type SuggestionStrategy,
  type Transition
} from "@shared";
import type { Day, Slot } from "./types";

export type SuggestionLimits = { sameDay: number; sameTime: number; nearest: number };
export type Suggestions = {
  strategy: SuggestionStrategy;
  requested: { date: string; time: string; timezone: string };
  suggestions: Slot[];
  notes: SuggestionNote[];
};

const dayNumber = (iso: string) => Math.round(Date.parse(iso) / DAY_MS);

/**
 * The 4-step cascade (PRD §8): same day → same clock time on nearby days → closest good times → nothing.
 * `T` is minutes since local midnight in the parent's zone, so "same time" survives DST changes.
 */
export function rankSuggestions(
  days: Day[],
  D: string,
  T: number,
  tz: string,
  limits: SuggestionLimits,
  exclude?: Date,
  transitions: Transition[] = []
): Suggestions {
  const mins = (s: Slot) => localClockMinutes(s.startUtc, tz);
  const open = (d: Day) => d.slots.filter(s => s.status === "OPEN" && (!exclude || s.startUtc.getTime() !== exclude.getTime()));
  const dist = (s: Slot) => Math.abs(mins(s) - T);
  const requested = { date: D, time: formatClockMinutes(T, true), timezone: tz };
  const notes = dstNotes(days, T, tz, transitions);
  const done = (strategy: SuggestionStrategy, suggestions: Slot[]): Suggestions => ({ strategy, requested, suggestions, notes });

  const sameDay = days.find(d => d.date === D);
  if (sameDay && open(sameDay).length) {
    return done(
      "SAME_DAY",
      open(sameDay)
        .sort((a, b) => dist(a) - dist(b) || a.startUtc.getTime() - b.startUtc.getTime())
        .slice(0, limits.sameDay)
    );
  }

  const target = dayNumber(D);
  const sameTime = days
    .filter(d => d.date !== D)
    .map(d => ({ d, hit: open(d).find(s => mins(s) === T), gap: Math.abs(dayNumber(d.date) - target) }))
    .filter((x): x is { d: Day; hit: Slot; gap: number } => !!x.hit)
    .sort((a, b) => a.gap - b.gap || dayNumber(b.d.date) - dayNumber(a.d.date))
    .slice(0, limits.sameTime)
    .map(x => x.hit);
  if (sameTime.length) return done("SAME_TIME", sameTime);

  const nearest: Slot[] = [];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (d.date === D) continue;
    for (const s of open(d)
      .sort((a, b) => dist(a) - dist(b) || a.startUtc.getTime() - b.startUtc.getTime())
      .slice(0, 2)) {
      if (nearest.length < limits.nearest) nearest.push(s);
    }
    if (nearest.length >= limits.nearest) break;
  }
  if (nearest.length)
    return done(
      "NEAREST",
      nearest.sort((a, b) => a.startUtc.getTime() - b.startUtc.getTime())
    );
  return done("NONE", []);
}

/** Explain when a clock change moves time T in or out of what mentors can cover. */
function dstNotes(days: Day[], T: number, tz: string, transitions: Transition[]) {
  const tr = transitions[0];
  if (!tr) return [];
  const hasT = (d: Day) => d.slots.some(s => localClockMinutes(s.startUtc, tz) === T);
  const before = days.filter(d => d.date < tr.date).some(hasT);
  const after = days.filter(d => d.date >= tr.date).some(hasT);
  const when = `From ${formatDay(tr.at, tz)}, ${formatClockMinutes(T)}`;
  if (before && !after)
    return [{ type: "DST_SHIFT" as const, message: `${when} is outside our mentors' hours because the clocks change.` }];
  if (!before && after) return [{ type: "DST_SHIFT" as const, message: `${when} becomes available because the clocks change.` }];
  return [];
}
