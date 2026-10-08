import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/session";

export function FinalCta() {
  const { parent } = useAuth();
  return (
    <section className="px-4 py-20">
      <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-5 rounded-2xl bg-primary px-8 py-12 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Ready when your family is</h2>
          <p className="opacity-80">Pick a time that works for you. It takes under a minute.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="brand" size="lg">
            <Link to="/book">
              Book a free trial <ArrowRight />
            </Link>
          </Button>
          {!parent && (
            <Button
              asChild
              size="lg"
              className="border border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link to="/signup">Create an account</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
