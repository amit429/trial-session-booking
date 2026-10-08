const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const subjectLabel = (s: string) => (s === "CODING" ? "Coding" : "Maths");

type CalendarBooking = { reference: string; startUtc: Date; endUtc: Date; subject: string; childName: string; meetingUrl: string; mentorName: string };

export function googleCalendarUrl(b: CalendarBooking): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Free ${subjectLabel(b.subject)} trial for ${b.childName}`,
    details: `Mentor: ${b.mentorName}\nJoin: ${b.meetingUrl}\nReference: ${b.reference}`,
    location: b.meetingUrl
  });
  const dates = `${stamp(b.startUtc)}/${stamp(b.endUtc)}`;
  return `https://calendar.google.com/calendar/render?${p.toString().replace(/\+/g, "%20")}&dates=${dates}`;
}

const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** RFC 5545 event in UTC, so every calendar shows it in the viewer's own zone. */
export function icsFile(b: CalendarBooking & { cancelled?: boolean }, now: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TrialDesk//Trial booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${b.cancelled ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VEVENT",
    `UID:${b.reference}@trialdesk.example`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(b.startUtc)}`,
    `DTEND:${stamp(b.endUtc)}`,
    `SUMMARY:${escapeIcs(`Free ${subjectLabel(b.subject)} trial for ${b.childName}`)}`,
    `DESCRIPTION:${escapeIcs(`Mentor: ${b.mentorName}\nJoin: ${b.meetingUrl}\nReference: ${b.reference}`)}`,
    `LOCATION:${escapeIcs(b.meetingUrl)}`,
    `URL:${b.meetingUrl}`,
    `STATUS:${b.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  return lines.join("\r\n") + "\r\n";
}
