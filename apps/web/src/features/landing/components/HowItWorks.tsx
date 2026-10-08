import { CalendarDays, PencilLine, Video } from "lucide-react";

const STEPS = [
  { Icon: CalendarDays, title: "Pick a time", text: "Choose a day and time on the calendar. Every time is shown in your own zone, and full times point you to the nearest open ones." },
  { Icon: PencilLine, title: "Tell us about your child", text: "Name, grade and subject. A mentor who's free at that time is assigned the moment you book." },
  { Icon: Video, title: "Join the class", text: "You get the class link, a calendar invite and a private link to change or cancel. No account needed." }
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 px-4 py-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex max-w-[640px] flex-col gap-3">
          <p className="text-sm font-semibold text-brand-text">How it works</p>
          <h2 className="text-3xl font-semibold tracking-tight">Booked in under a minute</h2>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand-text"><Icon className="size-5" /></span>
                <span className="font-mono text-xs text-muted-foreground">Step {i + 1}</span>
              </div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
