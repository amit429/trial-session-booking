import type { Subject } from "../models/subject.model";

export const subjectLabel = (s: Subject | string) => (s === "CODING" ? "Coding" : "Maths");
