import { Clock3, Globe2, Link2, Lock } from "lucide-react";

const POINTS = [
  {
    Icon: Globe2,
    title: "Your time zone, always",
    text: "Times are shown where you live and stay right when the clocks change in spring and autumn."
  },
  {
    Icon: Clock3,
    title: "After-school evenings",
    text: "Mentors work shifts matched to US and UK families, so evenings are available, not just school hours."
  },
  {
    Icon: Lock,
    title: "No account, no payment",
    text: "Book with just an email. Create an account later if you want all your bookings in one place."
  },
  {
    Icon: Link2,
    title: "Change of plans?",
    text: "Your private link lets you cancel any time before the class, and the time goes back to other families."
  }
];

export function Highlights() {
  return (
    <section className="px-4 py-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex max-w-[640px] flex-col gap-3">
          <p className="text-sm font-semibold text-brand-text">Why families book here</p>
          <h2 className="text-3xl font-semibold tracking-tight">Built for families across time zones</h2>
        </div>
        <div className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {POINTS.map(({ Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground">
                <Icon className="size-5" />
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{title}</h3>
                <p className="text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
