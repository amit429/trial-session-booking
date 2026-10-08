import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes, later ones winning (shadcn convention). */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map(p => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
