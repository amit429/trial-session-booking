export const SUBJECTS = ["CODING", "MATH"] as const;
export type Subject = (typeof SUBJECTS)[number];
