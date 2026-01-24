"use client";

import { Instagram, Sparkles, Calendar, Users } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useFloatAnimation } from "@/utils/motion";
import Image from "next/image";
import cloud from "@/public/Cloud.svg";

// If you want to prefetch on a parent route, keep this:
export const requiredAssets = ["/processed/direct/direct-1920.webp"];

export default function AIMemeGeneration() {
  const prefersReduced = useReducedMotion();
  const glowFloat1 = useFloatAnimation(7, 5, 0);
  const glowFloat2 = useFloatAnimation(6, 4.5, 0.5);
  const orbitAnimation = useFloatAnimation(6, 8, 0);

  return (
    <section className="
      w-full mx-auto px-3 md:px-7 py-7
      max-w-[1920px]
      min-[2000px]:px-10 min-[2000px]:py-12
      min-[3000px]:px-14 min-[3000px]:py-16
      min-[4000px]:px-16 min-[4000px]:py-20
    ">
      {/* Rounded cloud panel */}
      <div
        className="
          relative mx-auto overflow-hidden
          rounded-[22px] sm:rounded-[28px] md:rounded-[36px]
          min-[3000px]:rounded-[44px] min-[4000px]:rounded-[56px]
          border border-white/80
          bg-[linear-gradient(180deg,#F4F9FF_0%,#ECF4FF_48%,#EEF2FF_100%)]
          shadow-[0_8px_32px_rgba(27,13,63,0.08)]
          max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]
        "
      >
        {/* ambient blobs */}
        <motion.div
          className="
          -left-24 -top-28 h-[280px] w-[280px]
          sm:h-[360px] sm:w-[360px] md:h-[420px] md:w-[420px]
          min-[2000px]:h-[520px] min-[2000px]:w-[520px]
          min-[3000px]:h-[640px] min-[3000px]:w-[640px]
          min-[4000px]:h-[760px] min-[4000px]:w-[760px]
          bg-[radial-gradient(closest-side,rgba(124,126,244,0.25),rgba(124,126,244,0)_70%)]
            pointer-events-none absolute rounded-full
          "
          animate={glowFloat1}
        />
        <motion.div
          className="
          right-3 sm:right-6 top-4
          h-[140px] w-[140px] sm:h-[160px] sm:w-[160px] md:h-[180px] md:w-[180px]
          min-[2000px]:h-[220px] min-[2000px]:w-[220px]
          min-[3000px]:h-[260px] min-[3000px]:w-[260px]
          min-[4000px]:h-[320px] min-[4000px]:w-[320px]
          bg-[radial-gradient(70%_70%_at_75%_35%,rgba(255,96,96,0.7)_0%,rgba(255,0,122,0.35)_28%,rgba(110,123,255,0.5)_55%,transparent_100%)]
            blur-2xl pointer-events-none absolute rounded-full
          "
          animate={glowFloat2}
        />

        <div
          className="
            grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 sm:gap-8 lg:gap-10
            min-[2000px]:gap-12 min-[3000px]:gap-16 min-[4000px]:gap-20
            px-4 sm:px-6 md:px-8
            min-[2000px]:px-10 min-[3000px]:px-14 min-[4000px]:px-16
            py-6 sm:py-8 md:py-10 lg:py-14
            min-[2000px]:py-16 min-[3000px]:py-20 min-[4000px]:py-24
            max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]
            mx-auto
          "
        >
          {/* LEFT – Text content */}
          <div className="relative flex flex-col lg:h-full lg:justify-between">
            <h2 className="
              text-[24px] sm:text-[32px] md:text-[40px] lg:text-[48px] xl:text-[56px]
              min-[2000px]:text-[64px] min-[3000px]:text-[72px] min-[4000px]:text-[80px]
              font-semibold leading-[1.08] tracking-tight text-[#1B0D3F] break-words
            ">
              AI Meme Generation
            </h2>

            {/* features grid */}
            <div
              className="
                mt-6 sm:mt-8 lg:mt-10 lg:flex-1
                grid grid-cols-1 sm:grid-cols-2 lg:grid-rows-2
                gap-0
                border border-[#E5E7EB]
                rounded-2xl min-[3000px]:rounded-3xl overflow-hidden
                bg-white/60 backdrop-blur-sm
                shadow-[0_4px_12px_rgba(27,13,63,0.06)]
                divide-y sm:divide-y-0 sm:divide-x divide-[#E5E7EB]
              "
            >
              <div className="p-4 sm:p-5 md:p-6 min-[3000px]:p-8 transition-all duration-300 hover:bg-white/80 group lg:h-full lg:flex lg:items-center lg:justify-center">
                <FeatureRow
                  icon={<Instagram className="h-5 w-5 text-[#7C7EF4] transition-transform duration-300 group-hover:scale-110" />}
                  title="Post on Instagram"
                  desc="Directly publish your memes to Instagram with one click."
                />
              </div>

              <div className="p-4 sm:p-5 md:p-6 min-[3000px]:p-8 transition-all duration-300 hover:bg-white/80 group lg:h-full lg:flex lg:items-center lg:justify-center">
                <FeatureRow
                  icon={<Sparkles className="h-5 w-5 text-[#6E6FF2] transition-transform duration-300 group-hover:scale-110" />}
                  title="Generate memes for any industry"
                  desc="Create industry-specific memes tailored to your niche."
                />
              </div>

              <div className="p-4 sm:p-5 md:p-6 min-[3000px]:p-8 transition-all duration-300 hover:bg-white/80 group lg:h-full lg:flex lg:items-center lg:justify-center">
                <FeatureRow
                  icon={<Calendar className="h-5 w-5 text-[#7C7EF4] transition-transform duration-300 group-hover:scale-110" />}
                  title="Autoschedule on our calendar"
                  desc="Automatically schedule posts at optimal times."
                />
              </div>

              <div className="p-4 sm:p-5 md:p-6 min-[3000px]:p-8 transition-all duration-300 hover:bg-white/80 group lg:h-full lg:flex lg:items-center lg:justify-center">
                <FeatureRow
                  icon={<Users className="h-5 w-5 text-[#7C7EF4] transition-transform duration-300 group-hover:scale-110" />}
                  title="Connect multiple accounts"
                  desc="Manage and post to multiple social media accounts."
                />
              </div>
            </div>

            {/* top-left cloud - hidden on mobile for cleaner look */}
            <Image
              src={cloud}
              alt=""
              aria-hidden="true"
              sizes="(min-width:4000px) 1300px, (min-width:3000px) 1100px, (min-width:2000px) 900px, (min-width:1280px) 520px, 50vw"
              className="
                pointer-events-none absolute opacity-90 h-auto hidden lg:block
                right-0 top-[580px] w-[50vw]
                xl:w-[40vw] xl:top-[480px]
                2xl:w-[90vw] 2xl:left-[-700px] 2xl:top-[450px]
                max-w-[520px] xl:max-w-[520px]
                min-[2000px]:max-w-[900px]
                min-[3000px]:max-w-[1100px]
                min-[4000px]:max-w-[1300px]
              "
            />

            {/* bottom-right cloud (mirrored) - hidden on mobile */}
            <Image
              src={cloud}
              alt=""
              aria-hidden="true"
              sizes="(min-width:4000px) 1200px, (min-width:3000px) 1000px, (min-width:2000px) 800px, 55vw"
              className="
                pointer-events-none absolute h-auto -scale-x-100 opacity-80 hidden lg:block
                right-[-6%] top-[calc(50%-200px)]
                w-[55vw] max-w-[560px]
                min-[2000px]:max-w-[800px]
                min-[3000px]:max-w-[1000px]
                min-[4000px]:max-w-[1200px]
              "
            />
          </div>

          {/* RIGHT – Orbit graphic */}
          <div className="relative flex items-center justify-center lg:sticky lg:top-8 lg:self-start">
            <div
              className="
                relative w-full max-w-[560px]
                min-[2000px]:max-w-[640px]
                min-[3000px]:max-w-[760px]
                min-[4000px]:max-w-[880px] rounded-[28px] border border-[#DEE6FE]
                [content-visibility:auto] [contain-intrinsic-size:520px_520px]
              "
            >
              <motion.div
                className="
                  relative w-full rounded-[28px] border border-[#DEE6FE] bg-white/70 backdrop-blur-md
                  p-6 min-[2000px]:p-8 min-[3000px]:p-10
                  shadow-[0_20px_64px_rgba(28,33,67,0.16),0_0_0_1px_rgba(255,255,255,0.5)_inset]
                  transition-all duration-500 hover:shadow-[0_24px_72px_rgba(28,33,67,0.20),0_0_0_1px_rgba(255,255,255,0.6)_inset]
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
                      className="absolute top-[15%] left-[10%] px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-md text-xs font-semibold text-[#7C7EF4] shadow-[0_2px_8px_rgba(124,126,244,0.2),0_0_0_1px_rgba(255,255,255,0.8)_inset]"
                      animate={{
                        y: [0, -4, 0],
                        transition: { duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0 },
                      }}
                    >
                      Connect
                    </motion.div>
                    <motion.div
                      className="absolute top-[45%] right-[8%] px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-md text-xs font-semibold text-[#7C7EF4] shadow-[0_2px_8px_rgba(124,126,244,0.2),0_0_0_1px_rgba(255,255,255,0.8)_inset]"
                      animate={{
                        y: [0, -4, 0],
                        transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
                      }}
                    >
                      Schedule
                    </motion.div>
                    <motion.div
                      className="absolute bottom-[20%] left-[15%] px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-md text-xs font-semibold text-[#7C7EF4] shadow-[0_2px_8px_rgba(124,126,244,0.2),0_0_0_1px_rgba(255,255,255,0.8)_inset]"
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
      </div>
    </section>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <div className="relative w-full">
      <div className="flex flex-col items-center text-center gap-3 sm:gap-4 min-[3000px]:gap-5">
        {icon && (
          <div className="flex-shrink-0 grid h-10 w-10 sm:h-12 sm:w-12 place-items-center min-[3000px]:h-14 min-[3000px]:w-14 rounded-xl bg-gradient-to-br from-[#7C7EF4]/10 to-[#6E6FF2]/5 p-2.5 transition-all duration-300 group-hover:from-[#7C7EF4]/20 group-hover:to-[#6E6FF2]/10 group-hover:scale-110">{icon}</div>
        )}
        <div className="flex-1 min-w-0 w-full">
          <div className="
            text-[15px] sm:text-[16px] md:text-[17px] lg:text-[18px]
            min-[2000px]:text-[20px] min-[3000px]:text-[22px]
            font-semibold text-[#1E1B4B] leading-tight
            transition-colors duration-300 group-hover:text-[#301B69]
          ">
            {title}
          </div>
          {desc && (
            <div className="
              mt-1.5 sm:mt-2
              text-[13px] sm:text-[14px] md:text-[15px]
              text-[#5B5B76] leading-relaxed
              transition-colors duration-300 group-hover:text-[#6A6396]
            ">
              {desc}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

