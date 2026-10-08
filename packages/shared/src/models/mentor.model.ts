export type MentorPublicDto = { id: string; name: string; bio: string; shiftLabel: string; timezone: string };

/** One working block on one weekday, in the mentor's zone ("HH:mm"). */
export type WeeklyShiftDto = { weekday: number; start: string; end: string };
