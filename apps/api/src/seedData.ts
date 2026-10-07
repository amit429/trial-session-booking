/** The 10 seed mentors (Technical Design §15). Shift hours are IST minutes; `off` is the IST weekday off (1 = Mon). */
export type ShiftKey = "UK" | "USE" | "USW";
export const SHIFTS: Record<ShiftKey, { label: string; startMinute: number; endMinute: number }> = {
  UK: { label: "UK shift", startMinute: 13 * 60, endMinute: 23 * 60 + 30 },
  USE: { label: "US-East shift", startMinute: 30, endMinute: 7 * 60 + 30 },
  USW: { label: "US-West shift", startMinute: 3 * 60 + 30, endMinute: 9 * 60 + 30 }
};

export const MENTOR_SEED: { name: string; shift: ShiftKey; off: number; bio: string }[] = [
  { name: "Aarav Sharma", shift: "UK", off: 1, bio: "Python and game design. Six years teaching kids aged 8 to 14." },
  { name: "Priya Iyer", shift: "UK", off: 3, bio: "Maths olympiad coach who makes fractions feel like puzzles." },
  { name: "Rohan Mehta", shift: "UK", off: 5, bio: "Scratch and Roblox Studio for first-time coders." },
  { name: "Ananya Reddy", shift: "UK", off: 7, bio: "Web basics: HTML, CSS and a first JavaScript game." },
  { name: "Vikram Nair", shift: "USE", off: 2, bio: "AP Computer Science prep and Python projects." },
  { name: "Sneha Kulkarni", shift: "USE", off: 4, bio: "Singapore-method maths for grades 1 to 6." },
  { name: "Arjun Desai", shift: "USE", off: 6, bio: "Robotics with micro:bit and block coding." },
  { name: "Kavya Menon", shift: "USE", off: 7, bio: "Algebra and geometry with lots of visual models." },
  { name: "Ishaan Gupta", shift: "USW", off: 1, bio: "App Inventor and first mobile apps." },
  { name: "Meera Pillai", shift: "USW", off: 5, bio: "Mental maths and number sense for younger learners." }
];

export const mentorEmail = (name: string) => `${name.split(" ")[0].toLowerCase()}@mentors.trialdesk.example`;

/** Weekly rules for a seed mentor: one block per working weekday. Pass off = 0 for a 7-day week. */
export function seedRules(shift: ShiftKey, off: number) {
  const s = SHIFTS[shift];
  return [1, 2, 3, 4, 5, 6, 7].filter(d => d !== off).map(weekday => ({ weekday, startMinute: s.startMinute, endMinute: s.endMinute }));
}
