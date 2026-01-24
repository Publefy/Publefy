"use client";

import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import HeroBadge from "./ui/hero-badge";
import { useRouter } from "next/navigation";

type HeroSectionProps = {
  onGetStarted: () => void;
  onContactSales: () => void;
};

export default function HeroSection({
  onGetStarted,
  onContactSales,
}: HeroSectionProps) {
  const router = useRouter();

  // iOS Safari X/XS/XR/11 fix for dynamic bars
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };
    setVh();
    window.addEventListener("resize", setVh);
    window.addEventListener("orientationchange", setVh);
    return () => {
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  const handleGetStarted = () => router.push("/?auth=login");

  return (
    <section
      className="
        relative isolate                             /* ADD: isolate to create new stacking context */
        /* Fallback for older iOS: uses --vh set above */
        min-h-fit
        /* Prefer stable viewport height when supported */
        supports-[min-height:00svh]:min-h-fit

        py-6 sm:py-14 md:py-10 lg:py-10 xl:py-10
        pt-0 md:pt-10
        pb-0 md:pb-[max(env(safe-area-inset-bottom),0px)]
        flex md:block items-start md:items-center
      "
    >
      <div
        className="
          mx-auto max-w-screen-xl px-4 sm:px-6 lg:px-8 text-center overflow-x-clip
          relative z-[50]                        /* ADD: ensure hero content is above background layers */
          pointer-events-auto                    /* ADD: make sure this layer receives clicks */
        "
      >
        {/* Top Badge */}
        <div
          className="
            inline-flex items-center space-x-2 sm:space-x-3
            text-xs sm:text-sm font-medium text-[#301B69]
            shadow-md rounded-[20px]
          "
        >
          <HeroBadge />
        </div>

        {/* Text overlay for readability - hidden on desktop */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/50 via-white/25 to-transparent pointer-events-none z-[45] md:hidden" />

        {/* Heading */}
        <h1
          className="
            relative z-[50] mt-4 md:mt-6 
            font-bold leading-[1.06]
            tracking-[-0.02em] sm:tracking-[-0.03em] md:tracking-[-0.04em]
            mx-auto max-w-[90vw] md:max-w-none
            text-[clamp(28px,8vw,56px)] sm:text-[clamp(32px,6vw,48px)] break-words
          "
        >
          <span
            className="
              block
              bg-[linear-gradient(107.03deg,#301B69_10.95%,#6C6FEC_35.35%)]
              bg-clip-text text-transparent
              [text-shadow:0px_5px_4px_rgba(53,29,112,0.48)]
              px-1 font-lexend font-normal text-center
              text-[clamp(28px,8vw,76px)]
              leading-[1.08] tracking-[-0.01em]
            "
          >
            Generate Viral
          </span>

          <span
            className="
              block text-[#301B69]
              [text-shadow:0px_2px_2px_rgba(53,29,112,0.18)]
              px-1 font-lexend font-normal text-center
              text-[clamp(26px,7vw,76px)]
              leading-[1.1]
            "
          >
            Memes In Minutes
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="
            relative z-[50] mt-4 md:mt-5
            font-inter font-normal text-center text-[#5B5B76]
            mx-auto max-w-[90vw] md:max-w-[44rem] lg:max-w-[48rem]
            text-[clamp(14px,4vw,20px)]
            leading-[1.5]
          "
        >
          Turn videos into viral memes with AI and schedule posts automatically — built for creators and brands.
        </p>

        {/* CTA buttons */}
        <div
          className="
            mt-6 md:mt-8
            flex flex-col sm:flex-row
            gap-3 sm:gap-4 justify-center
            w-full max-w-md sm:max-w-none mx-auto
            relative z-[100]                      /* ADD: float CTA row above any overlays */
            pointer-events-auto                   /* ADD */
          "
        >
          <button
            onClick={handleGetStarted}
            type="button"
            aria-label="Get started with Publefy - Create account or login"
            className="shimmer1
              w-full sm:w-auto cursor-pointer
              inline-flex items-center justify-center gap-2
              min-h-[44px] h-10 sm:h-12 px-4 sm:px-6
              rounded-[14px] sm:rounded-[16px]
              text-white font-medium text-sm sm:text-base
              border border-[#5a4bcb]/40
              bg-gradient-to-b from-[#7C7EF4] to-[#6F80F0]
              shadow-[0_8px_24px_rgba(91,12,213,0.20),inset_0_8px_10px_rgba(255,255,255,0.22)]
              motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-300
              touch-manipulation
              pointer-events-auto
            "
          >
            Get Started
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

        </div>
      </div>
    </section>
  );
}
