import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const initials = (name: string) => name.split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
export const subjectLabel = (s: string) => (s === "CODING" ? "Coding" : "Maths");
