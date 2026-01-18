"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { UserRound, Calendar, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import HowItWorkIcon from "@/public/processed/how_iy_work/how_iy_work-640.webp";
import RocketIcon from "@/public/processed/Rocket 1/Rocket 1-1920.webp";
import TargetIcon from "@/public/processed/Business Target 1/Business Target 1-1920.webp";
import FlameIcon from "@/public/processed/flame/flame-1920.webp";

// ====== animation variants ======
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
};

const float = (duration = 8, prefersReduced: boolean) => {
  if (prefersReduced) return undefined;
  return {
    y: [0, -8, 0],
  transition: { duration, repeat: Infinity, ease: "easeInOut" },
  };
};

export default function HowItWorks() {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start center", "end center"],
  });

  const handleGetStarted = () => router.push("/?auth=login");

  // Update active step based on scroll
  useEffect(() => {
    if (prefersReduced) return;

    const unsubscribe = scrollYProgress.on("change", (latest) => {
      if (latest < 0.33) {
        setActiveStep(0);
      } else if (latest < 0.66) {
        setActiveStep(1);
      } else {
        setActiveStep(2);
      }
    });

    return () => unsubscribe();
  }, [scrollYProgress, prefersReduced]);

  return (
    <section
      ref={sectionRef}
      className="
        w-full mx-auto px-3 md:px-7 py-3
        max-w-[1920px]
        min-[2000px]:px-10 min-[2000px]:py-4
        min-[3000px]:px-14 min-[3000px]:py-5
        min-[4000px]:px-16 min-[4000px]:py-6
      "
    >
      <div
        className="
          relative mx-auto overflow-hidden rounded-[28px]
          sm:rounded-[48px] xl:rounded-[64px]
          min-[3000px]:rounded-[72px] min-[4000px]:rounded-[80px]
          border border-[#E7E5F7]
          bg-[linear-gradient(180deg,#FFE2F3_0%,#EEE5FF_45%,#F7F7FF_100%)]
          p-3 sm:p-4 md:p-5 xl:p-6
          min-[2000px]:p-6 min-[3000px]:p-7 min-[4000px]:p-8
          max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]
        "
      >
        {/* cloud blobs (responsive sizes) */}
        <motion.div
          aria-hidden
          className="
            pointer-events-none absolute -top-24 -left-16 h-56 w-56
            sm:h-72 sm:w-72 xl:h-80 xl:w-80
            min-[2000px]:h-96 min-[2000px]:w-96
            min-[3000px]:h-[28rem] min-[3000px]:w-[28rem]
            min-[4000px]:h-[32rem] min-[4000px]:w-[32rem]
            rounded-full bg-white/70 blur-3xl
          "
          animate={float(9, prefersReduced)}
        />
        <motion.div
          aria-hidden
          className="
            pointer-events-none absolute top-10 -right-8 h-48 w-48
            sm:h-56 sm:w-56 xl:h-64 xl:w-64
            min-[2000px]:h-80 min-[2000px]:w-80
            min-[3000px]:h-[22rem] min-[3000px]:w-[22rem]
            min-[4000px]:h-[26rem] min-[4000px]:w-[26rem]
            rounded-full bg-white/60 blur-3xl
          "
          animate={float(7, prefersReduced)}
        />
        <motion.div
          aria-hidden
          className="
            pointer-events-none absolute -bottom-24 -right-20 h-72 w-72
            sm:h-80 sm:w-80 xl:h-96 xl:w-96
            min-[2000px]:h-[28rem] min-[2000px]:w-[28rem]
            min-[3000px]:h-[32rem] min-[3000px]:w-[32rem]
            min-[4000px]:h-[36rem] min-[4000px]:w-[36rem]
            rounded-full bg-[#EFE9FF]/90 blur-3xl
          "
          animate={float(10, prefersReduced)}
        />

        {/* chip */}
        <motion.div
          className="mb-1 sm:mb-1.5 flex justify-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
        >
          <motion.span
            variants={scaleIn}
            className="
              inline-flex items-center gap-2 rounded-full border border-[#E7E5F7]
              bg-white/90 px-3 py-1 sm:px-3.5 sm:py-1.5
              text-[11px] sm:text-xs font-medium text-[#2E1A67]
              shadow-[0_6px_18px_rgba(64,36,143,0.12)]
              min-[3000px]:text-sm min-[3000px]:px-4 min-[4000px]:px-5
            "
          >
            <Image src={HowItWorkIcon} alt="" className="h-3 w-3 sm:h-3.5 sm:w-3.5 min-[3000px]:h-4 min-[3000px]:w-4" />
            How it Works
          </motion.span>
        </motion.div>

        {/* heading + sub */}
        <motion.h2
          className="
            text-center font-semibold leading-tight tracking-tight text-[#2B1470] break-words
            text-[18px] sm:text-[20px] md:text-[24px] xl:text-[28px]
            min-[2000px]:text-[32px]
            min-[3000px]:text-[36px]
            min-[4000px]:text-[40px]
          "
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
          variants={fadeUp}
        >
          Simple Fast, Accurate
        </motion.h2>
        <motion.p
          className="
            mt-0.5 text-center text-xs sm:text-sm text-[#3B2E76]/70
            min-[3000px]:text-sm min-[4000px]:text-base
          "
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.6 }}
          variants={fadeUp}
        >
          Three simple steps to viral content
        </motion.p>

        {/* center vertical line (hide on small) */}
        <div
          className="
            pointer-events-none hidden md:block absolute left-1/2
            top-[140px] xl:top-[160px] bottom-[100px] xl:bottom-[120px]
            min-[2000px]:top-[200px] min-[2000px]:bottom-[140px]
            min-[3000px]:top-[240px] min-[3000px]:bottom-[180px]
            min-[4000px]:top-[280px] min-[4000px]:bottom-[220px]
            w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-black/30 to-transparent
          "
        />


        {/* === ROW 1 === */}
        <Row index={0} stepIndex={0} activeStep={activeStep} prefersReduced={prefersReduced}>
          <ColLeft>
            <motion.h3
              className={`
                text-[20px] sm:text-[22px] md:text-[26px] xl:text-[28px]
                min-[2000px]:text-[32px] min-[3000px]:text-[36px] min-[4000px]:text-[40px]
                font-semibold transition-colors duration-300
                ${activeStep === 0 && !prefersReduced ? "text-[#7C7EF4]" : "text-[#271A6D]"}
              `}
              variants={fadeUp}
            >
              Upload or Select
            </motion.h3>
            <motion.p
              className="
                mt-1 max-w-[52ch] text-[11px] sm:text-[12px]
                min-[2000px]:text-[13px] min-[3000px]:text-[14px]
                leading-relaxed text-[#5A5192]
              "
              variants={fadeUp}
            >
              Upload your own videos or choose from our library of pre-processed content. Our AI analyzes everything for optimal meme potential.
            </motion.p>
          </ColLeft>

          <ColCenter>
            <motion.div variants={scaleIn}>
              <SquareBadge isActive={activeStep === 0 && !prefersReduced}>
                <UserRound className="h-4 w-4 text-[#3D338F] min-[3000px]:h-5 min-[3000px]:w-5" />
              </SquareBadge>
            </motion.div>
          </ColCenter>

          <ColRight>
            <motion.div className="w-full" variants={fadeUp}>
              <Image
                src={RocketIcon}
                alt="Rocket"
                width={360}
                height={360}
                className="
                  relative md:left-[40px] xl:left-[60px]
                  min-[3000px]:left-[80px] min-[4000px]:left-[100px]
                  mx-auto md:mx-0 h-auto
                  w-[160px] sm:w-[180px] md:w-[220px] xl:w-[280px]
                  min-[2000px]:w-[320px] min-[3000px]:w-[360px] min-[4000px]:w-[400px]
                "
              />
            </motion.div>
          </ColRight>
        </Row>

        {/* === ROW 2 === */}
        <Row index={1} stepIndex={1} activeStep={activeStep} prefersReduced={prefersReduced}>
          <ColLeft>
            <motion.div variants={fadeUp}>
              <Image
                src={FlameIcon}
                alt="Flame"
                width={320}
                height={320}
                className="
                  relative left-0 md:left-4 xl:left-6
                  min-[3000px]:left-8 min-[4000px]:left-10
                  mx-auto md:mx-0 h-auto
                  w-[160px] sm:w-[180px] md:w-[220px] xl:w-[260px]
                  min-[2000px]:w-[300px] min-[3000px]:w-[340px] min-[4000px]:w-[380px]
                "
              />
            </motion.div>
          </ColLeft>

          <ColCenter>
            <motion.div variants={scaleIn}>
              <SquareBadge isActive={activeStep === 1 && !prefersReduced}>
                <Calendar className="h-4 w-4 text-[#3D338F] min-[3000px]:h-5 min-[3000px]:w-5" />
              </SquareBadge>
            </motion.div>
          </ColCenter>

          <ColRight>
            <motion.div className="w-full" variants={fadeUp}>
              <h3
                className={`
                  relative md:left-[40px] xl:left-[60px]
                  min-[3000px]:left-[80px] min-[4000px]:left-[100px]
                  text-[16px] sm:text-[18px] md:text-[20px] xl:text-[22px]
                  min-[2000px]:text-[24px] min-[3000px]:text-[26px] min-[4000px]:text-[28px]
                  font-semibold transition-colors duration-300
                  ${activeStep === 1 && !prefersReduced ? "text-[#7C7EF4]" : "text-[#271A6D]"}
                `}
              >
                Generate & Customize
              </h3>
              <p
                className="
                  mt-1 md:ml-[40px] xl:ml-[60px]
                  min-[3000px]:ml-[80px] min-[4000px]:ml-[100px]
                  max-w-[48ch]
                  font-normal text-[11px] sm:text-[12px] md:text-[13px]
                  min-[2000px]:text-[14px] min-[3000px]:text-[15px]
                  leading-[148%] text-[#301B69]
                "
              >
                Enter your industry and instantly generate 10 custom memes made for your niche. Select your favorites and regenerate any you want to improve.
              </p>
            </motion.div>
          </ColRight>
        </Row>

        {/* === ROW 3 === */}
        <Row index={2} stepIndex={2} activeStep={activeStep} prefersReduced={prefersReduced}>
          <ColLeft>
            <motion.h3
              className={`
                text-[16px] sm:text-[18px] md:text-[20px] xl:text-[22px]
                min-[2000px]:text-[24px] min-[3000px]:text-[26px] min-[4000px]:text-[28px]
                font-semibold transition-colors duration-300
                ${activeStep === 2 && !prefersReduced ? "text-[#7C7EF4]" : "text-[#271A6D]"}
              `}
              variants={fadeUp}
            >
              Post & Engage
            </motion.h3>
            <motion.p
              className="
                mt-1 max-w-[52ch] text-[11px] sm:text-[12px]
                min-[2000px]:text-[13px] min-[3000px]:text-[14px]
                leading-relaxed text-[#5A5192]
              "
              variants={fadeUp}
            >
              Connect your social accounts and post directly to your pages. Watch your engagement soar with perfectly crafted content.
            </motion.p>
          </ColLeft>

          <ColCenter>
            <motion.div variants={scaleIn}>
              <SquareBadge isActive={activeStep === 2 && !prefersReduced}>
                <SlidersHorizontal className="h-4 w-4 text-[#3D338F] min-[3000px]:h-5 min-[3000px]:w-5" />
              </SquareBadge>
            </motion.div>
          </ColCenter>

          <ColRight>
            <motion.div variants={fadeUp}>
              <Image
                src={TargetIcon}
                alt="Target"
                width={360}
                height={360}
                className="
                  relative md:left-[40px] xl:left-[60px]
                  min-[3000px]:left-[80px] min-[4000px]:left-[100px]
                  mx-auto md:mx-0 h-auto
                  w-[160px] sm:w-[180px] md:w-[220px] xl:w-[280px]
                  min-[2000px]:w-[320px] min-[3000px]:w-[360px] min-[4000px]:w-[400px]
                "
              />
            </motion.div>
          </ColRight>
        </Row>

        {/* === CTA === */}
        <motion.div
          className="
            mt-4 sm:mt-5 md:mt-6 xl:mt-7
            mx-auto w-full
            max-w-full sm:max-w-[48rem] md:max-w-[62rem] xl:max-w-[76rem]
            min-[2000px]:max-w-[88rem] min-[3000px]:max-w-[96rem] min-[4000px]:max-w-[104rem]
            rounded-[24px] sm:rounded-[28px] xl:rounded-[36px]
            border border-[#EEE9FF]
            bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(243,238,255,0.95)_100%)]
            px-5 sm:px-5 md:px-6
            py-4 sm:py-5 md:py-6
            shadow-[0_12px_40px_rgba(36,18,94,0.10),0_16px_50px_rgba(36,18,94,0.12)]
          "
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
        >
          <div className="flex flex-col items-start gap-3 sm:gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div
                className="
                  text-[14px] sm:text-[16px] md:text-[18px] xl:text-[20px]
                  min-[2000px]:text-[22px] min-[3000px]:text-[24px] min-[4000px]:text-[26px]
                  font-semibold leading-tight text-[#25154F]
                "
              >
                Ready to boost your reach with viral memes?
              </div>
              <p
                className="
                  mt-1 text-[11px] sm:text-[12px]
                  min-[2000px]:text-[13px] min-[3000px]:text-[14px]
                  text-[#5A5192]
                "
              >
                Create scroll-stopping memes in seconds with AI. Join PubleFy today and grow your audience effortlessly.
              </p>
            </div>

            <motion.button
              whileHover={{ y: -2, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="shimmer1
                inline-flex h-[46px] sm:h-[50px] md:h-[52px]
                min-[2000px]:h-[56px] min-[3000px]:h-[60px]
                items-center justify-center gap-1.5
                rounded-xl sm:rounded-2xl
                border border-black/10
                bg-[linear-gradient(180deg,#5E46D8_0%,#2B186B_100%)]
                px-5 sm:px-6 min-[3000px]:px-7
                text-sm sm:text-[15px] min-[2000px]:text-base min-[3000px]:text-[18px]
                font-semibold text-white
                shadow-[0_10px_26px_rgba(27,11,89,0.24),inset_0_10px_14px_rgba(255,255,255,0.18)]
                hover:shadow-[0_12px_32px_rgba(27,11,89,0.30)]
                transition-shadow
              "
              onClick={handleGetStarted}
            >
              Get Started <span aria-hidden>→</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ========== layout helpers (3 columns per row) ========== */
function Row({
  children,
  index = 0,
  stepIndex,
  activeStep,
  prefersReduced,
}: {
  children: React.ReactNode;
  index?: number;
  stepIndex?: number;
  activeStep?: number;
  prefersReduced?: boolean;
}) {
  // Mobile: stacked card layout
  const isMobileCard = stepIndex !== undefined;

  return (
    <motion.div
      className={`
        relative
        ${isMobileCard ? "md:grid md:grid-cols-[1fr_auto_1fr]" : "grid grid-cols-1 md:grid-cols-[1fr_auto_1fr]"}
        ${isMobileCard ? "mb-4 md:mb-0 rounded-2xl border border-[#E7E5F7] bg-white/70 p-5 md:p-0 md:bg-transparent md:border-0 shadow-sm md:shadow-none" : ""}
        items-center justify-items-center
        gap-3 md:gap-5
        py-4 md:py-6
        ${stepIndex === activeStep && !prefersReduced ? "md:bg-white/40 md:rounded-2xl md:px-4 md:shadow-sm" : ""}
        transition-all duration-300
      `}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.12, delayChildren: index * 0.1 } },
      }}
    >
      {children}
    </motion.div>
  );
}


function ColLeft({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="order-1" variants={fadeUp}>
      {children}
    </motion.div>
  );
}

function ColCenter({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="
        order-2 relative hidden md:grid place-items-center
      "
      variants={scaleIn}
    >
      {children}
    </motion.div>
  );
}

function ColRight({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="order-3 gap-[12px]" variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/* square badge style used in the center column */
function SquareBadge({
  children,
  isActive = false,
}: {
  children: React.ReactNode;
  isActive?: boolean;
}) {
  return (
    <>
      {/* tiny white halo to "break" the line */}
      <div
        className="
          absolute h-12 w-12 rounded-2xl bg-white/95 blur-[1px]
          min-[3000px]:h-14 min-[3000px]:w-14
          min-[4000px]:h-16 min-[4000px]:w-16
        "
        aria-hidden
      />
      <div
        className={`
          relative grid h-12 w-12 place-items-center rounded-2xl
          border transition-all duration-300
          ${isActive ? "border-[#7C7EF4] bg-white shadow-[0_0_0_4px_rgba(124,126,244,0.2),0_8px_26px_rgba(124,126,244,0.3)]" : "border-[#E7E5F7] bg-white/85 shadow-[0_8px_26px_rgba(31,21,84,0.08)]"}
          min-[3000px]:h-14 min-[3000px]:w-14
          min-[4000px]:h-16 min-[4000px]:w-16
        `}
      >
        {children}
      </div>
    </>
  );
}
