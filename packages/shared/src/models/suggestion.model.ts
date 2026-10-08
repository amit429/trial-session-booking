import type { SlotDto } from "./slot.model";

export type SuggestionStrategy = "SAME_DAY" | "SAME_TIME" | "NEAREST" | "NONE";
export type SuggestionNote = { type: "DST_SHIFT"; message: string };

export type SuggestionsResponse = {
  strategy: SuggestionStrategy;
  requested: { date: string; time: string; timezone: string };
  suggestions: SlotDto[];
  notes: SuggestionNote[];
};
