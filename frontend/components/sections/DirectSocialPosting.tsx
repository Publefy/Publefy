"use client";

import Image from "next/image";
import { Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useFloatAnimation } from "@/utils/motion";

// If you want to prefetch on a parent route, keep this:
export const requiredAssets = ["/processed/direct/direct-1920.webp"];

export default function DirectSocialPosting() {
  const prefersReduced = useReducedMotion();
  const orbitAnimation = useFloatAnimation(6, 8, 0);

  return (
    <section
      className="
        w-full mx-auto px-3 md:px-7 py-6
        max-w-[1920px]
        min-[2000px]:px-10 min-[2000px]:py-10
        min-[3000px]:px-14 min-[3000px]:py-14
        min-[4000px]:px-16 min-[4000px]:py-18
      "
    >
      <div
        className="
          relative mx-auto overflow-hidden rounded-[32px]
          border border-[#E7E5F7]
          bg-[linear-gradient(180deg,#F5FBFF_0%,#EEF6FF_50%,#EFF3FF_100%)]
          max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px]
        "
      >
        <div
          className="
            grid gap-10 px-6 py-10
            md:px-10 md:py-12
            min-[2000px]:gap-12 min-[2000px]:px-12 min-[2000px]:py-14
            min-[3000px]:gap-16 min-[3000px]:px-14 min-[3000px]:py-16
            lg:grid-cols-[1.1fr_0.9fr]
            mx-auto
          "
        >
          <div className="flex flex-col gap-5">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#7C7EF4]">
              Social Media Command Center
            </p>
            <h2
              className="
                text-[32px] font-semibold leading-tight text-[#1B0D3F]
                md:text-[44px] lg:text-[52px]
                min-[2000px]:text-[60px] min-[3000px]:text-[68px]
              "
            >
              Deploy memes to every platform
            </h2>
            <p className="max-w-lg text-base text-[#2A2550]/80">
              One upload distributes to Instagram, Facebook, TikTok, LinkedIn, WhatsApp, and more.
            </p>
            <div className="grid gap-3 text-sm text-[#2A2550]/90">
              {[
                "Instant formatting for every native aspect ratio.",
                "One dashboard covers reels, shorts, stories, and posts.",
                "Schedule once; publish everywhere simultaneously."
              ].map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <span className="h-[6px] w-[6px] rounded-full bg-[#7C7EF4]" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="
              relative mx-auto w-full max-w-[560px]
              min-[2000px]:max-w-[640px]
              min-[3000px]:max-w-[760px]
              min-[4000px]:max-w-[880px] rounded-[28px] border border-[#DEE6FE]
              [content-visibility:auto] [contain-intrinsic-size:520px_520px] mt-6 lg:mt-0
            "
          >
            <motion.div
              className="
                relative w-full rounded-[28px] border border-[#DEE6FE] bg-white/60
                p-6 min-[2000px]:p-8 min-[3000px]:p-10
                shadow-[0_18px_60px_rgba(28,33,67,0.12)]
              "
              {...(orbitAnimation ? { animate: orbitAnimation } : {})}
            >
              <Image
                src="/processed/direct/direct-1920.webp"
                alt="Direct social posting orbit graphic"
                width={760}
                height={760}
                sizes="(min-width:1280px) 760px, 92vw"
                className="mx-auto h-auto w-full"
                loading="lazy"
                decoding="async"
                priority={false}
              />
              {!prefersReduced && (
                <>
                  <motion.div
                    className="absolute top-[15%] left-[10%] px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-medium text-[#7C7EF4] shadow-sm"
                    animate={{
                      y: [0, -4, 0],
                      transition: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0 },
                    }}
                  >
                    Connect
                  </motion.div>
                  <motion.div
                    className="absolute top-[45%] right-[8%] px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-medium text-[#7C7EF4] shadow-sm"
                    animate={{
                      y: [0, -4, 0],
                      transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                    }}
                  >
                    Schedule
                  </motion.div>
                  <motion.div
                    className="absolute bottom-[20%] left-[15%] px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-medium text-[#7C7EF4] shadow-sm"
                    animate={{
                      y: [0, -4, 0],
                      transition: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 },
                    }}
                  >
                    Track
                  </motion.div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

