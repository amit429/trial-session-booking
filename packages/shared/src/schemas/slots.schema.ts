import { z } from "zod";
import { isoDateField, timezoneField } from "./fields";

export const SlotsQuery = z.object({
  tz: timezoneField,
  from: isoDateField.optional(),
  days: z.coerce.number().int().min(1).max(14).default(14)
});

export const SuggestionsQuery = z.object({
  tz: timezoneField,
  date: isoDateField,
  time: z.string().regex(/^([01]\d|2[0-3]):(00|30)$/, "Use HH:mm on the half hour")
});
