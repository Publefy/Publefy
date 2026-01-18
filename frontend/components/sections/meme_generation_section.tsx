"use client";

import { Sparkles, GripVertical, Filter, Edit, BarChart3 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useFloatAnimation } from "@/utils/motion";
import Image from "next/image";
import meme1 from "@/public/meme/meme_1.svg";
import meme2 from "@/public/meme/meme_2.svg";
import meme3 from "@/public/meme/meme_3.svg";
import meme4 from "@/public/meme/meme_4.svg";
import cloud from "@/public/Cloud.svg";

export default function AIMemeGeneration() {
  const prefersReduced = useReducedMotion();
  const glowFloat1 = useFloatAnimation(7, 5, 0);
  const glowFloat2 = useFloatAnimation(6, 4.5, 0.5);

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
          border border-white/60
          bg-[linear-gradient(180deg,#F4F9FF_0%,#ECF4FF_48%,#EEF2FF_100%)]
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
            grid items-start gap-8 sm:gap-10
            min-[2000px]:gap-12 min-[3000px]:gap-16 min-[4000px]:gap-20
            px-4 sm:px-6 md:px-8
            min-[2000px]:px-10 min-[3000px]:px-14 min-[4000px]:px-16
            py-8 sm:py-10 md:py-14
            min-[2000px]:py-16 min-[3000px]:py-20 min-[4000px]:py-24
            lg:grid-cols-[1.1fr_1fr]
            max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]
            mx-auto
          "
        >
          {/* LEFT – device-like preview card */}
          <div className="relative">
            <div
              className="
                relative mx-auto w-full
                max-w-[520px] sm:max-w-[560px]
                min-[2000px]:max-w-[640px]
                min-[3000px]:max-w-[760px]
                min-[4000px]:max-w-[880px]
                rounded-[24px] sm:rounded-[28px] md:rounded-[34px]
                min-[3000px]:rounded-[40px] min-[4000px]:rounded-[48px]
                border border-[#D9E7FF]
                bg-[linear-gradient(180deg,rgba(243,250,255,0.92)_0%,rgba(230,244,255,0.92)_100%)]
                p-4 sm:p-5 md:p-6
                min-[2000px]:p-8 min-[3000px]:p-10
                shadow-[0_18px_60px_rgba(28,33,67,0.12)]
                backdrop-blur
              "
            >
              {/* glossy highlight */}
              <div className="
                pointer-events-none absolute right-6 sm:right-8 top-6
                h-[120px] w-[120px] sm:h-[140px] sm:w-[140px] md:h-[160px] md:w-[160px]
                min-[2000px]:h-[180px] min-[2000px]:w-[180px]
                min-[3000px]:h-[220px] min-[3000px]:w-[220px]
                rounded-full
                bg-[radial-gradient(60%_60%_at_70%_30%,rgba(255,150,200,0.6)_0%,rgba(140,160,255,0.55)_45%,rgba(124,126,244,0.35)_60%,transparent_100%)]
                blur-xl
              " />

              <h3 className="
                text-[22px] sm:text-[24px] md:text-[28px]
                min-[2000px]:text-[32px] min-[3000px]:text-[36px]
                font-semibold leading-tight text-[#0F1C2E]
              ">
                Meme Generator
              </h3>
              <p className="
                mt-1 text-[13px] sm:text-[14px] leading-relaxed text-[#223356]/70
                min-[2000px]:text-[16px] min-[3000px]:text-[18px]
              ">
                Create customized videos meme and boost audience engagement.
              </p>

              <PickAMemeUI />
            </div>
          </div>

          {/* RIGHT – copy + features */}
          <div className="relative">
            <div className="
              inline-flex items-center gap-2 rounded-full border border-[#F7E5E5FF]
              bg-white/80 px-3.5 py-1.5 sm:px-4 sm:py-2
              min-[3000px]:px-5
              text-xs sm:text-sm min-[3000px]:text-base text-[#2e1a67]
              shadow-[0_6px_20px_rgba(64,36,143,0.12)] backdrop-blur
            ">
              <Sparkles className="h-4 w-4 min-[3000px]:h-5 min-[3000px]:w-5" />
              Features
            </div>

            <h2 className="
              mt-4 sm:mt-6
              text-[28px] sm:text-[36px] md:text-[44px] xl:text-[56px]
              min-[2000px]:text-[64px] min-[3000px]:text-[72px] min-[4000px]:text-[80px]
              font-semibold leading-[1.08] tracking-tight text-[#1B0D3F] break-words
            ">
              AI Meme Generation
            </h2>

            <p className="
              mt-3 sm:mt-4 max-w-2xl
              text-[14px] sm:text-base min-[2000px]:text-[18px] min-[3000px]:text-[20px]
              leading-relaxed text-[#2A2550]/80
            ">
              Generate 10 industry-specific memes instantly. Regenerate any you don't like with one click.
            </p>

            {/* features grid */}
            <div
              className="
                mt-8 sm:mt-10
                grid grid-cols-1 md:grid-cols-2
                border border-[#E5E7EB]
                rounded-2xl min-[3000px]:rounded-3xl overflow-hidden
              "
            >
              <div className="p-5 sm:p-6 min-[3000px]:p-8 border-b md:border-b-0 md:border-r border-[#E5E7EB]">
                <FeatureRow
                  icon={<GripVertical className="h-5 w-5 text-[#7C7EF4]" />}
                  title="Drag-and-Drop"
                  desc="Quickly arrange captions, images, or templates with an intuitive editor."
                />
              </div>

              <div className="p-5 sm:p-6 min-[3000px]:p-8 border-b md:border-b-0 border-[#E5E7EB]">
                <FeatureRow
                  icon={<Filter className="h-5 w-5 text-[#6E6FF2]" />}
                  title="Smart Filters & Views"
                  desc="Find memes by trending topics, formats, or engagement potential."
                />
              </div>

              <div className="p-5 sm:p-6 min-[3000px]:p-8 md:border-r border-[#E5E7EB]">
                <FeatureRow
                  icon={<Edit className="h-5 w-5 text-[#7C7EF4]" />}
                  title="Inline Edits"
                  desc="Add or tweak captions, emojis, and stickers directly on your meme."
                />
              </div>

              <div className="p-5 sm:p-6 min-[3000px]:p-8">
                <FeatureRow
                  icon={<BarChart3 className="h-5 w-5 text-[#7C7EF4]" />}
                  title="Meme Performance Tracker"
                  desc="See which generated memes perform best across platforms."
                />
              </div>
            </div>

            {/* top-left cloud */}
            <Image
              src={cloud}
              alt=""
              aria-hidden="true"
              sizes="(min-width:4000px) 1300px, (min-width:3000px) 1100px, (min-width:2000px) 900px, (min-width:1280px) 520px, 50vw"
              className="
                pointer-events-none absolute opacity-90 h-auto
                right-0 top-[580px] w-[50vw]
                sm:w-[50vw] sm:top-[580px] sm:right-0
                md:w-[70vw] md:left-[-700px] md:top-[450px]
                xl:w-[40vw] xl:top-[480px]
                2xl:w-[90vw] 2xl:left-[-700px] 2xl:top-[450px]
                max-w-[520px] md:max-w-[500px] xl:max-w-[520px]
                min-[2000px]:max-w-[900px]
                min-[3000px]:max-w-[1100px]
                min-[4000px]:max-w-[1300px]
              "
            />

            {/* bottom-right cloud (mirrored) */}
            <Image
              src={cloud}
              alt=""
              aria-hidden="true"
              sizes="(min-width:4000px) 1200px, (min-width:3000px) 1000px, (min-width:2000px) 800px, 55vw"
              className="
                pointer-events-none absolute h-auto -scale-x-100 opacity-80
                right-[-6%] top-[calc(50%-200px)]
                w-[55vw] max-w-[560px]
                md:max-w-[720px]
                min-[2000px]:max-w-[800px]
                min-[3000px]:max-w-[1000px]
                min-[4000px]:max-w-[1200px]
              "
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PickAMemeUI() {
  return (
    <div
      className="
        mt-4 sm:mt-5
        rounded-[18px] sm:rounded-[20px] md:rounded-[22px]
        min-[3000px]:rounded-[26px]
        border border-[#E6ECFF] bg-white
        p-3.5 sm:p-4 min-[2000px]:p-5 min-[3000px]:p-6
        shadow-[0_10px_30px_rgba(15,28,46,0.08)]
      "
    >
      {/* Title */}
      <div className="
        mb-3 text-[16px] sm:text-[17px] md:text-[18px]
        min-[2000px]:text-[20px] min-[3000px]:text-[22px]
        font-semibold text-[#0F1C2E]
      ">
        Pick a meme
      </div>

      {/* Segmented control */}
      <div className="mb-4 grid grid-cols-2 rounded-2xl bg-[#F5F6FD] p-1 min-[3000px]:p-1.5">
        <button className="
          h-10 rounded-xl border border-[#E5E9FF] bg-white
          text-[13px] sm:text-[14px] min-[3000px]:text-[15px]
          font-semibold text-[#0F1C2E]
          shadow-[0_1px_0_rgba(255,255,255,0.9),0_1px_6px_rgba(16,24,40,0.06)]
        ">
          Generated Memes
        </button>
        <button className="
          h-10 rounded-xl text-[13px] sm:text-[14px] min-[3000px]:text-[15px]
          font-medium text-[#8B90AA] hover:bg-[#EEF0FB]
        ">
          Regenerate again
        </button>
      </div>

      <div className="mb-2 text-[10px] sm:text-[11px] min-[3000px]:text-[12px] font-semibold tracking-[0.06em] text-[#9AA0BE]">
        POPULAR
      </div>

      {/* Scroll area */}
      <div
        className="
          relative max-h-[48vh] sm:max-h-[360px] md:max-h-[380px]
          min-[2000px]:max-h-[460px] min-[3000px]:max-h-[520px]
          overflow-y-auto pr-1
        "
        style={{ scrollbarWidth: "thin", scrollbarColor: "#DCE1F7 transparent" }}
      >
        {/* Top row */}
        <div className="grid grid-cols-2 gap-3 min-[3000px]:gap-4">
          <HeroCard src={meme1} alt="Meme 1" />
          <HeroCard src={meme2} alt="Meme 2" />
        </div>

        {/* Bottom row */}
        <div className="mt-3 grid grid-cols-2 gap-3 min-[3000px]:gap-4">
          <ThumbCard src={meme3} alt="Meme 3" />
          <ThumbCard src={meme4} alt="Meme 4" />
        </div>

        {/* decorative rail */}
        <div className="pointer-events-none absolute right-[2px] top-20 hidden h-[180px] w-[6px] rounded-full bg-gradient-to-b from-[#EFF2FF] via-[#E1E6FF] to-[#EFF2FF] md:block" />
      </div>
    </div>
  );
}

/* --- tiny building blocks --- */

function HeroCard({ src, alt }: { src: any; alt: string }) {
  return (
    <div className="
      aspect-[16/10] w-full overflow-hidden rounded-2xl
      min-[3000px]:rounded-3xl
      bg-[#F8F9FD]
      shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_6px_20px_rgba(27,13,63,0.08)]
    ">
      <Image
        src={src}
        alt={alt}
        sizes="(min-width:4000px) 880px, (min-width:3000px) 720px, (min-width:2000px) 600px, 50vw"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function ThumbCard({ src, alt }: { src: any; alt: string }) {
  return (
    <div className="
      aspect-[4/3] w-full overflow-hidden rounded-2xl
      min-[3000px]:rounded-3xl
      bg-[#F1F3F8]
      shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_6px_20px_rgba(15,28,46,0.06)]
    ">
      <Image
        src={src}
        alt={alt}
        sizes="(min-width:4000px) 620px, (min-width:3000px) 520px, (min-width:2000px) 420px, 33vw"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative">
      <div className="flex items-start gap-3 min-[3000px]:gap-4">
        {icon && (
          <div className="mt-0.5 grid h-7 w-7 place-items-center min-[3000px]:h-8 min-[3000px]:w-8">{icon}</div>
        )}
        <div>
          <div className="
            text-[16px] sm:text-[17px] md:text-[18px]
            min-[2000px]:text-[20px] min-[3000px]:text-[22px]
            font-semibold text-[#1E1B4B]
          ">
            {title}
          </div>
          <p className="
            mt-1 max-w-[42ch]
            text-[13px] sm:text-sm min-[2000px]:text-[15px] min-[3000px]:text-[16px]
            leading-relaxed text-[#4b4668]/80
          ">
            {desc}
          </p>
        </div>
      </div>
    </div>
  );
}

