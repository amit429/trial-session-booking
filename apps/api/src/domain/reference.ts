import { customAlphabet } from "nanoid";

/** Human-friendly booking reference without 0/O/1/I. */
const six = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
export const newReference = () => `CY-${six()}`;

const ten = customAlphabet("abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789", 10);
export const meetingSuffix = () => ten();
