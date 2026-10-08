import { SiteFooter, SiteHeader } from "@/components/layout";
import { Faq } from "../components/Faq";
import { FinalCta } from "../components/FinalCta";
import { Hero } from "../components/Hero";
import { Highlights } from "../components/Highlights";
import { HowItWorks } from "../components/HowItWorks";
import { Subjects } from "../components/Subjects";

/** Home: what the trial is, live open times in the visitor's zone, and the way in (book, sign in, sign up). */
export function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Subjects />
        <Highlights />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
