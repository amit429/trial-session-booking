import { describe, expect, it } from "vitest";
import {
  addDays,
  dayWindow,
  expandRules,
  formatSlot,
  formatTime,
  formatZoneLabel,
  gridStarts,
  localClockMinutes,
  localDate,
  localDayWindow,
  normalizeZone,
  timeOfDayGroup,
  upcomingTransitions,
  zoneAbbreviation
} from "@shared/time";

const NY = "America/New_York";
const LDN = "Europe/London";
const IST = "Asia/Kolkata";
const at = (iso: string) => new Date(iso);
const hours = (w: { start: Date; end: Date }) => (w.end.getTime() - w.start.getTime()) / 3_600_000;

describe("normalizeZone", () => {
  it("accepts canonical IANA names", () => {
    expect(normalizeZone("Europe/London")).toBe("Europe/London");
  });
  it("maps legacy aliases browsers still report", () => {
    expect(normalizeZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(normalizeZone("US/Eastern")).toBe("America/New_York");
  });
  it("throws on unknown zones", () => {
    expect(() => normalizeZone("Mars/Base")).toThrow(/time zone/i);
  });
});

describe("day windows across DST", () => {
  it("New York fall-back day is 25 hours long", () => {
    expect(hours(localDayWindow("2026-11-01", NY))).toBe(25);
  });
  it("New York spring-forward day is 23 hours long", () => {
    expect(hours(localDayWindow("2027-03-14", NY))).toBe(23);
  });
  it("builds 08:00–21:00 local windows per date, not by fixed offset", () => {
    const before = dayWindow("2026-10-31", NY, 8 * 60, 21 * 60);
    const after = dayWindow("2026-11-02", NY, 8 * 60, 21 * 60);
    expect(before.start.toISOString()).toBe("2026-10-31T12:00:00.000Z");
    expect(after.start.toISOString()).toBe("2026-11-02T13:00:00.000Z");
  });
});

describe("formatting", () => {
  it("shows the same IST class in EDT before and EST after 1 Nov", () => {
    expect(formatSlot(at("2026-10-31T12:30:00Z"), NY)).toBe("Sat 31 Oct · 8:30 AM EDT");
    expect(formatSlot(at("2026-11-02T13:30:00Z"), NY)).toBe("Mon 2 Nov · 8:30 AM EST");
  });
  it("uses BST/GMT for London, not GMT+1", () => {
    expect(formatSlot(at("2026-10-20T12:30:00Z"), LDN)).toBe("Tue 20 Oct · 1:30 PM BST");
    expect(formatSlot(at("2026-10-27T12:30:00Z"), LDN)).toBe("Tue 27 Oct · 12:30 PM GMT");
  });
  it("never shows a bare IST", () => {
    expect(zoneAbbreviation("Europe/Dublin", at("2026-07-01T12:00:00Z"))).toBe("GMT+1");
    expect(zoneAbbreviation(IST, at("2026-07-01T12:00:00Z"))).toBe("IST (India)");
    expect(formatZoneLabel(IST, at("2026-07-01T12:00:00Z"))).toBe("India Standard Time (UTC+05:30)");
    expect(formatZoneLabel("Europe/Dublin", at("2026-07-01T12:00:00Z"))).toBe("Irish time (UTC+01:00)");
    expect(formatZoneLabel(NY, at("2026-07-01T12:00:00Z"))).toBe("Eastern Time (UTC−04:00)");
  });
  it("labels the repeated fall-back hour distinctly", () => {
    expect(formatSlot(at("2026-11-01T05:30:00Z"), NY)).toBe("Sun 1 Nov · 1:30 AM EDT");
    expect(formatSlot(at("2026-11-01T06:30:00Z"), NY)).toBe("Sun 1 Nov · 1:30 AM EST");
  });
  it("groups by local time of day", () => {
    expect(timeOfDayGroup(at("2026-10-20T13:00:00Z"), NY)).toBe("morning");
    expect(timeOfDayGroup(at("2026-10-20T17:00:00Z"), NY)).toBe("afternoon");
    expect(timeOfDayGroup(at("2026-10-20T21:00:00Z"), NY)).toBe("evening");
  });
});

describe("local date helpers", () => {
  it("a Tuesday evening in LA is Wednesday morning in India", () => {
    const t = at("2026-10-21T02:30:00Z");
    expect(localDate(t, "America/Los_Angeles")).toBe("2026-10-20");
    expect(localDate(t, IST)).toBe("2026-10-21");
    expect(localClockMinutes(t, IST)).toBe(8 * 60);
  });
  it("adds calendar days", () => {
    expect(addDays("2026-10-31", 2)).toBe("2026-11-02");
  });
  it("grid starts are UTC-aligned 30-minute steps", () => {
    const g = gridStarts(at("2026-10-20T12:10:00Z"), at("2026-10-20T13:30:00Z"), 30);
    expect(g.map(d => d.toISOString())).toEqual(["2026-10-20T12:30:00.000Z", "2026-10-20T13:00:00.000Z", "2026-10-20T13:30:00.000Z"]);
  });
});

describe("expandRules", () => {
  it("turns an IST night shift into the right UTC interval", () => {
    const out = expandRules([{ weekday: 3, startMinute: 30, endMinute: 450 }], IST, at("2026-10-20T00:00:00Z"), at("2026-10-22T00:00:00Z"));
    expect(out.map(i => [i.start.toISOString(), i.end.toISOString()])).toContainEqual([
      "2026-10-20T19:00:00.000Z",
      "2026-10-21T02:00:00.000Z"
    ]);
  });
  it("shifts a rule starting in a spring-forward gap to the first valid time", () => {
    const out = expandRules([{ weekday: 7, startMinute: 120, endMinute: 240 }], NY, at("2027-03-14T00:00:00Z"), at("2027-03-15T00:00:00Z"));
    expect(out[0].start.toISOString()).toBe("2027-03-14T07:00:00.000Z"); // 03:00 EDT
    expect(out[0].end.toISOString()).toBe("2027-03-14T08:00:00.000Z"); // 04:00 EDT
  });
});

describe("upcomingTransitions", () => {
  it("finds the 1 Nov clocks-go-back change for New York", () => {
    const t = upcomingTransitions(NY, "2026-10-20", 14);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ date: "2026-11-01", fromOffset: -240, toOffset: -300, back: true });
  });
  it("finds nothing when no change is in range", () => {
    expect(upcomingTransitions(NY, "2026-10-08", 14)).toEqual([]);
  });
});

describe("every supported US and UK/Ireland zone, across both 2026 clock changes", () => {
  // The same India class (18:30 IST) before the UK and US changes (20 Oct) and after both (10 Nov).
  const before = "2026-10-20T13:00:00Z";
  const after = "2026-11-10T13:00:00Z";
  it.each([
    ["America/New_York", "9:00 AM EDT", "8:00 AM EST"],
    ["America/Chicago", "8:00 AM CDT", "7:00 AM CST"],
    ["America/Denver", "7:00 AM MDT", "6:00 AM MST"],
    ["America/Phoenix", "6:00 AM MST", "6:00 AM MST"], // Arizona has no DST
    ["America/Los_Angeles", "6:00 AM PDT", "5:00 AM PST"],
    ["America/Anchorage", "5:00 AM AKDT", "4:00 AM AKST"],
    ["Pacific/Honolulu", "3:00 AM HST", "3:00 AM HST"], // Hawaii has no DST
    ["Europe/London", "2:00 PM BST", "1:00 PM GMT"],
    ["Europe/Dublin", "2:00 PM GMT+1", "1:00 PM GMT"] // never the ambiguous "IST"
  ])("%s shows %s, then %s", (zone, beforeLabel, afterLabel) => {
    const label = (iso: string) => `${formatTime(iso, zone)} ${zoneAbbreviation(zone, iso)}`;
    expect(label(before)).toBe(beforeLabel);
    expect(label(after)).toBe(afterLabel);
  });
});
