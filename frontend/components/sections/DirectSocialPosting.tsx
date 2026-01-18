"use client";

import Image from "next/image";
import { Sparkles, Calendar, Upload, Share2, BarChart3 } from "lucide-react";
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
        w-full mx-auto px-3 md:px-7 py-7
        max-w-[1920px]
        min-[2000px]:px-10 min-[2000px]:py-12
        min-[3000px]:px-14 min-[3000px]:py-16
        min-[4000px]:px-16 min-[4000px]:py-20
      "
    >
      <div
        className="
          relative mx-auto w-full overflow-hidden
          rounded-[36px] min-[3000px]:rounded-[44px] min-[4000px]:rounded-[56px]
          border border-[#E7E5F7]
          bg-[linear-gradient(180deg,#F5FBFF_0%,#EEF6FF_50%,#EFF3FF_100%)]
          max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]
        "
      >
        {/* lightweight ambient glow (no backdrop-blur, no huge box-shadow) */}
        <Glow
          className="
            -left-24 -top-28 h-[380px] w-[380px]
            min-[2000px]:h-[460px] min-[2000px]:w-[460px]
            min-[3000px]:h-[560px] min-[3000px]:w-[560px]
            min-[4000px]:h-[640px] min-[4000px]:w-[640px]
            opacity-70
            bg-[radial-gradient(closest-side,rgba(124,126,244,0.22),rgba(124,126,244,0)_70%)]
          "
        />

        <div
          className="
            grid items-center gap-10
            px-4 py-10 md:px-8 md:py-14
            min-[2000px]:gap-12 min-[2000px]:px-10 min-[2000px]:py-16
            min-[3000px]:gap-16 min-[3000px]:px-14 min-[3000px]:py-20
            min-[4000px]:gap-20 min-[4000px]:px-16 min-[4000px]:py-24
            lg:grid-cols-[1.15fr_1fr]
            max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]
            mx-auto
          "
        >
          {/* LEFT: copy + features */}
          <div>
            <div
              className="
                inline-flex items-center gap-2 rounded-full border border-[#E7E5F7]
                bg-white/80 px-4 py-2 text-sm text-[#2e1a67]
                shadow-[0_6px_20px_rgba(64,36,143,0.12)]
                min-[3000px]:px-5 min-[3000px]:text-base
              "
            >
              <Sparkles className="h-4 w-4 min-[3000px]:h-5 min-[3000px]:w-5" />
              Features
            </div>

            <h2
              className="
                mt-6 text-[40px] md:text-[56px]
                min-[2000px]:text-[64px] min-[3000px]:text-[72px] min-[4000px]:text-[80px]
                font-semibold leading-[1.08] tracking-tight text-[#1B0D3F] break-words
              "
            >
              Direct Social Posting
            </h2>

            <p
              className="
                mt-4 max-w-2xl text-base leading-relaxed text-[#2A2550]/80
                min-[2000px]:text-[18px] min-[3000px]:text-[20px]
              "
            >
              Connect your Facebook account and post directly to your pages. More platforms coming soon.
            </p>

            {/* features grid */}
            <div
              className="
                mt-10 grid grid-cols-1 gap-6 md:gap-8 md:grid-cols-2
                min-[3000px]:gap-10
                relative
              "
            >
              <Feature
                icon={<Calendar className="h-5 w-5 text-[#7C7EF4]" />}
                title="Scheduled Posting"
                desc="Queue memes to drop at the perfect time for maximum engagement."
              />
              <Feature
                icon={<Upload className="h-5 w-5 text-[#6E6FF2]" />}
                title="Drag-and-Drop Uploads"
                desc="Quickly drop in your meme, choose platforms, and go live."
                divider
              />
              <Feature
                icon={<Share2 className="h-5 w-5 text-[#7C7EF4]" />}
                title="Multi-Platform Sync"
                desc="Publish to Facebook, TikTok, Instagram, X, and more in one click."
              />
              <Feature
                icon={<BarChart3 className="h-5 w-5 text-[#7C7EF4]" />}
                title="Engagement Insights"
                desc="Track likes, shares, and comments across every channel."
                divider
              />
            </div>
          </div>

          {/* RIGHT: image (raster, sized to container) */}
          <div
            className="
              relative mx-auto w-full max-w-[560px]
              min-[2000px]:max-w-[640px]
              min-[3000px]:max-w-[760px]
              min-[4000px]:max-w-[880px] rounded-[28px] border border-[#DEE6FE]
              [content-visibility:auto] [contain-intrinsic-size:520px_520px]
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
              {/* Orbit callouts */}
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

/* --- helpers --- */
function Feature({
  icon,
  title,
  desc,
  divider,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  divider?: boolean;
}) {
  return (
    <div className="relative rounded-xl border border-[#E6E3F5]/40 bg-white/50 p-5 transition-all hover:border-[#E6E3F5] hover:bg-white/70 hover:shadow-sm">
      {divider && (
        <div className="pointer-events-none absolute -left-6 top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-[#E6E3F5] to-transparent md:block" />
      )}
      <div className="flex items-start gap-3 min-[3000px]:gap-4">
        {icon && (
          <div className="mt-0.5 grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-[#7C7EF4]/10 min-[3000px]:h-8 min-[3000px]:w-8">
          {icon}
        </div>
        )}
        <div>
          <div
            className="
              text-[18px] min-[2000px]:text-[20px] min-[3000px]:text-[22px]
              font-semibold text-[#1E1B4B]
            "
          >
            {title}
          </div>
          <p
            className="
              mt-1 max-w-[42ch]
              text-sm min-[2000px]:text-[15px] min-[3000px]:text-[16px]
              leading-relaxed text-[#4b4668]/80
            "
          >
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

function Glow({ className = "" }: { className?: string }) {
  return <div className={`pointer-events-none absolute rounded-full ${className}`} />;
}
