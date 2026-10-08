import { ChevronDown } from "lucide-react";

const FAQ = [
  {
    q: "How long is the trial class?",
    a: "60 minutes, live and one-to-one with a mentor, online. You'll get the link as soon as you book."
  },
  {
    q: "Do I need an account?",
    a: "No. Book with your email and use the private link in your confirmation to manage it. If you'd like to see all your bookings in one place, create an account with the same email."
  },
  {
    q: "What if the time I want is full?",
    a: "Full times are shown so you know why. Click one and we'll offer the closest open times that day, the same time on nearby days, or the next good times."
  },
  {
    q: "Which time zones do you cover?",
    a: "Families across the US, the UK and Ireland. Times are always shown in your own zone, including when the clocks change."
  },
  {
    q: "Can I book more than one trial?",
    a: "Each family can have one upcoming free trial at a time. Once it's done or cancelled, you can book another."
  }
];

export function Faq() {
  return (
    <section className="border-t border-border bg-background px-4 py-20">
      <div className="mx-auto grid max-w-[1100px] gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-brand-text">Questions</p>
          <h2 className="text-3xl font-semibold tracking-tight">Good to know</h2>
        </div>
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
