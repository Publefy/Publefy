"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  EasingDefinition,
  motion,
  useScroll,
  useTransform,
  Variants,
  useReducedMotion,
} from "framer-motion";

import { NavBar } from "./nav-bar";
import HeroSection from "./hero-section";
import MemeMarquee from "./sections/MemeMarquee";
import AIMemeGeneration from "./sections/meme_generation_section";
import DirectSocialPosting from "./sections/DirectSocialPosting";
import PricingPlans from "./sections/PricingPlans";
import Testimonials from "./sections/Testimonials";
import FaqWithClouds from "./sections/FaqWithClouds";
import CtaFooterClouds from "./sections/CtaFooterClouds";

/* ---------------- Anim helpers ---------------- */



const EASE_OUT: EasingDefinition = [0.22, 1, 0.36, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
};

const sectionVariant: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

function SectionReveal({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <motion.section
      id={id}
      className={`${className ?? ""} relative z-20 [content-visibility:auto] [contain-intrinsic-size:1px_1000px]`}
      variants={sectionVariant}
      initial="hidden"
      whileInView="show"
      viewport={{ amount: 0.15, once: true }}
    >
      <motion.div variants={fadeUp}>{children}</motion.div>
    </motion.section>
  );
}

/* ---------------- Page ---------------- */

export default function LandingPage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const prefersReduced = useReducedMotion();

  // Parallax
  const { scrollY } = useScroll();
  const leftCloudY = useTransform(scrollY, [0, 600], [0, -40]);
  const rightCloudTopY = useTransform(scrollY, [0, 600], [0, -20]);
  const rightCloudMidY = useTransform(scrollY, [0, 600], [0, -60]);
  const rightCloudLowY = useTransform(scrollY, [0, 600], [0, -100]);

  // --- Smooth-scroll handoff reader (keeps URL clean)
  useEffect(() => {
    // find the sticky header for precise offset
    const header = document.querySelector("header");
    const pillH = (header as HTMLElement | null)?.offsetHeight ?? 80;
    const topGap = 20; // header top-5 ~ 20px
    const offset = pillH + topGap;

    const performScroll = (id: string, behavior: ScrollBehavior = "smooth") => {
      const el = document.getElementById(id);
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior });
    };

    const fromSession = sessionStorage.getItem("scrollTarget");
    if (fromSession) {
      sessionStorage.removeItem("scrollTarget");
      // wait one tick so layout is ready, then smooth scroll
      setTimeout(() => performScroll(fromSession, "smooth"), 0);
      return;
    }

    // Optional: honor a direct hash, but clean URL after scrolling
    const hash = window.location.hash?.slice(1);
    if (hash) {
      requestAnimationFrame(() => {
        performScroll(hash, "smooth");
        history.replaceState(null, "", "/"); // remove #hash from bar
      });
    }
  }, []);

  // Auto-open processor after successful login if resume flag is present
  useEffect(() => {
    try {
      const shouldOpen = sessionStorage.getItem("resumeVideoProcessorOpen");
      if (shouldOpen) {
        // Store target for smooth scroll to features (where processor section lives)
        sessionStorage.removeItem("resumeVideoProcessorOpen");
        sessionStorage.setItem("scrollTarget", "features");
        // also trigger immediate open if hero already in view
        try {
          const ev = new CustomEvent("videoProcessor:resume-request");
          window.dispatchEvent(ev);
        } catch {}
      }
    } catch {}
  }, []);

  return (
    <div className="relative min-h-[100svh] bg-white overflow-x-clip ">{/**/}

      <NavBar />

      {/* HERO */}
      <div ref={heroRef} className="relative isolate z-20 min-h-fit h-auto bg-indigo-fade mt-16 md:mt-40">
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-[80px] bg-gradient-to-b from-white/0 to-white" />

        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {/* Left group */}
          <motion.div
            style={prefersReduced ? undefined : { y: leftCloudY }}
            className="
              will-change-transform transform-gpu origin-top-left
              min-[2000px]:scale-[1.1]
              min-[3000px]:scale-[1.25]
              min-[4000px]:scale-[1.4]
            "
          >
            <div
              aria-hidden
              className="absolute left-0 top-[123px] h-[928px] w-[1395px] bg-[url('/Cloud_left.svg')] bg-left bg-no-repeat bg-contain opacity-100"
            />
            <div
              aria-hidden
              className="absolute left-0 top-[520px] h-[928px] w-[1395px] bg-[url('/Cloud_left.svg')] bg-left bg-no-repeat bg-contain opacity-100"
            />
          </motion.div>

          {/* Top-right */}
          <motion.div
            style={prefersReduced ? undefined : { y: rightCloudTopY }}
            className="
              will-change-transform transform-gpu origin-top-right
              min-[2000px]:scale-[1.1]
              min-[3000px]:scale-[1.25]
              min-[4000px]:scale-[1.4]
            "
          >
            <div
              aria-hidden
              className="absolute right-0 -top-[120px] h-[526px] w-[904px] bg-[url('/Cloud_top_right.svg')] bg-right bg-no-repeat bg-contain opacity-100"
            />
          </motion.div>

          {/* Bottom-right layers */}
          <motion.div
            style={prefersReduced ? undefined : { y: rightCloudMidY }}
            className="
              will-change-transform transform-gpu origin-top-right
              min-[2000px]:scale-[1.08]
              min-[3000px]:scale-[1.2]
              min-[4000px]:scale-[1.32]
            "
          >
            <div
              aria-hidden
              className="absolute right-0 top-[20px] aspect-[1442/962] w-[90vw] bg-[url('/cloud-right-bottom.png')] bg-right bg-no-repeat bg-contain opacity-70"
            />
          </motion.div>

          <motion.div
            style={prefersReduced ? undefined : { y: rightCloudLowY }}
            className="
              will-change-transform transform-gpu origin-top-right
              min-[2000px]:scale-[1.12]
              min-[3000px]:scale-[1.24]
              min-[4000px]:scale-[1.36]
            "
          >
            <div
              aria-hidden
              className="absolute right-0 top-[180px] aspect-[1442/962] w-[90vw] bg-[url('/cloud-right-bottom.png')] bg-right bg-no-repeat bg-contain opacity-100"
            />
            <div
              aria-hidden
              className="absolute right-0 top-[500px] aspect-[1442/962] w-[90vw] bg-[url('/cloud-right-bottom.png')] bg-right bg-no-repeat bg-contain opacity-100"
            />
          </motion.div>
        </div>

        {/* Hero content */}
        <motion.div
          initial={prefersReduced ? undefined : { opacity: 0, y: 24 }}
          animate={prefersReduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-[100] pointer-events-auto"
        >
          <HeroSection
            onGetStarted={() => router.push("/?auth=login")}
            onContactSales={() =>
              window.open(
                "https://calendar.app.google/PPFeknvdixs6ANhw7",
                "_blank",
                "noopener,noreferrer"
              )
            }
          />
        </motion.div>
      </div>

      {/* MEME MARQUEE LOOP */}
      <MemeMarquee />

      {/* Content sections */}
      <SectionReveal id="features">
        <AIMemeGeneration />
      </SectionReveal>

      <SectionReveal>
        <DirectSocialPosting />
      </SectionReveal>

      <SectionReveal id="pricing">
        <PricingPlans />
      </SectionReveal>

      <SectionReveal id="testimonials">
        <Testimonials />
      </SectionReveal>

      {/* FAQ + footer */}
      <section className="relative z-20">
        <SectionReveal id="faq">
          <FaqWithClouds />
        </SectionReveal>

        {/* Spacer to prevent overlap */}
        <div className="h-8 md:h-12" />

        <footer className="relative z-10">
          <div className="relative z-10">
            <SectionReveal>
              <CtaFooterClouds />
            </SectionReveal>
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#f9f4ff] to-[#f3ecff]" />
        </footer>
      </section>
    </div>
  );
}
