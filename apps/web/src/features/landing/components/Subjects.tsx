import { ArrowRight, Calculator, Code2 } from "lucide-react";
import { Link } from "react-router-dom";

const SUBJECTS = [
  { value: "CODING", Icon: Code2, title: "Coding", text: "From first Scratch projects to Python, web pages and simple games.", grades: "Grades 1–12" },
  { value: "MATH", Icon: Calculator, title: "Maths", text: "Number sense, fractions, algebra and geometry, explained with visuals.", grades: "Grades 1–12" }
] as const;

export function Subjects() {
  return (
    <section className="border-y border-border bg-background px-4 py-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex max-w-[640px] flex-col gap-3">
          <p className="text-sm font-semibold text-brand-text">Subjects</p>
          <h2 className="text-3xl font-semibold tracking-tight">Try the subject your child is curious about</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {SUBJECTS.map(({ value, Icon, title, text, grades }) => (
            <Link key={value} to={`/book?subject=${value}`} className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-xs transition-colors hover:border-brand">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-lg bg-muted group-hover:bg-brand group-hover:text-white"><Icon className="size-5" /></span>
                <span className="text-xs font-medium text-muted-foreground">{grades}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground">{text}</p>
              </div>
              <span className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-brand-text">Book a {title.toLowerCase()} trial <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
