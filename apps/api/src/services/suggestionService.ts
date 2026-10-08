import { upcomingTransitions, type SuggestionsResponse } from "@shared";
import type { Deps } from "../container";
import { rankSuggestions } from "../domain/suggestions";
import { toSlotDto, type SlotService } from "./slotService";

export class SuggestionService {
  constructor(private deps: Deps, private slots: SlotService) {}

  /** Suggestions for parent-local date D at clock minutes T (PRD §8). */
  async suggest(tz: string, D: string, T: number, exclude?: Date): Promise<SuggestionsResponse> {
    const today = this.slots.today(tz);
    const days = await this.slots.getDays(tz, today);
    const { horizonDays } = this.deps.config.scheduling;
    const r = rankSuggestions(days, D, T, tz, this.deps.config.suggestions, exclude, upcomingTransitions(tz, today, horizonDays));
    return { ...r, suggestions: r.suggestions.map(toSlotDto) };
  }
}
