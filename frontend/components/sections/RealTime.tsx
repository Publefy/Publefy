"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, Variants } from "framer-motion";

/* ====================== Helpers ====================== */
const formatCompact = (n: number) => {
  const nf = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
  return nf.format(n).toUpperCase();
};

/* ====================== Delta (matches Figma) ====================== */
const StatDelta = ({
  value,
  suffix = " this minute",
}: {
  value: number;
  suffix?: string;
}) => {
  return (
    <div
      className="
        absolute
        bottom-3 right-3 sm:bottom-4 sm:right-4 lg:bottom-6 lg:right-6
        w-auto h-[22px]
        text-right font-inter font-normal
        text-[12px] sm:text-[14px] lg:text-[16px]
        leading-[136%] text-[#301B69]
      "
    >
      +{value}
      {suffix}
    </div>
  );
};

/* ====================== Card using your SVG ====================== */
const GlassCard = ({
  children,
  bgSrc = "/Intersect.svg",
}: {
  children: React.ReactNode;
  bgSrc?: string;
}) => (
  <div
    className="
      relative
      w-[clamp(200px,44vw,274px)]
      aspect-square
    "
  >
    <img
      src={bgSrc}
      alt=""
      className="absolute inset-0 h-full w-full select-none pointer-events-none"
      draggable={false}
    />
    <div
      className="
        relative z-10 h-full w-full rounded-[32px] sm:rounded-[40px] lg:rounded-[48px]
        p-5 sm:p-6 lg:p-8
      "
    >
      {children}
    </div>
  </div>
);

/* ====================== Icon chip (Tailwind gradient) ====================== */
const IconBadge = ({ src, alt }: { src: string; alt: string }) => (
  <div
    className="
      mb-4 sm:mb-5
      inline-flex items-center justify-center
      h-10 w-10 sm:h-12 sm:w-12
      rounded-2xl ring-1 ring-violet-200/70
      bg-[linear-gradient(125.05deg,_#D1D1FF_-3.85%,_rgba(226,226,253,0)_179.76%)]
    "
  >
    <img src={src} alt={alt} className="h-5 w-5 sm:h-6 sm:w-6" draggable={false} />
  </div>
);

/* ====================== Counter ====================== */
const Counter = ({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) => {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const controls: { raf: number | null } = { raf: null };
    const start = display;
    const end = value;
    const duration = 600; // ms
    const startAt = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - startAt) / duration);
      const current = Math.round(start + (end - start) * p);
      setDisplay(current);
      if (p < 1) controls.raf = requestAnimationFrame(step);
    };
    controls.raf = requestAnimationFrame(step);
    return () => controls.raf && cancelAnimationFrame(controls.raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <div className={className}>{formatCompact(display)}</div>;
};

/* ====================== Animations ====================== */
const listStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const slideItem: Variants = {
  hidden: (side: "left" | "right") => ({
    opacity: 0,
    x: side === "left" ? -28 : 28,
  }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

/* ====================== Main ====================== */
export default function RealTimeImpact() {
  const [now, setNow] = useState(new Date());
  const [stats, setStats] = useState({
    accounts: 2900,
    likes: 1_300_000,
    views: 15_600_000,
    engagement: 94.4,
  });

  const [deltas] = useState({
    accounts: 2,
    likes: 94,
    views: 626,
    engagement: 0.2,
  });

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setStats((s) => ({
        accounts: s.accounts + 2,
        likes: s.likes + 94,
        views: s.views + 626,
        engagement: Math.max(
          0,
          Math.min(100, Number((s.engagement + (Math.random() * 0.1 - 0.05)).toFixed(1)))
        ),
      }));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const lastUpdate = useMemo(
    () =>
      now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [now]
  );

  // Card descriptors so we can render once for mobile & desktop layouts
  const CARDS = [
    {
      key: "accounts",
      bg: "/Intersect1.svg",
      icon: "/engagement.svg",
      title: "Accounts Managed",
      valueEl: (
        <Counter
          value={stats.accounts}
          className="-mt-1 font-lexend font-medium text-[36px] sm:text-[46px] lg:text-[58px] leading-[136%] text-[#301B69] text-left"
        />
      ),
      delta: deltas.accounts,
    },
    {
      key: "likes",
      bg: "/Intersect2.svg",
      icon: "/like.svg",
      title: "Total Likes Generated",
      valueEl: (
        <Counter
          value={stats.likes}
          className="-mt-1 font-lexend font-medium text-[36px] sm:text-[46px] lg:text-[58px] leading-[136%] text-[#301B69] text-left"
        />
      ),
      delta: deltas.likes,
    },
    {
      key: "views",
      bg: "/Intersect3.svg",
      icon: "/views.svg",
      title: "Total Views Generated",
      valueEl: (
        <Counter
          value={stats.views}
          className="-mt-1 font-lexend font-medium text-[36px] sm:text-[46px] lg:text-[58px] leading-[136%] text-[#301B69] text-left"
        />
      ),
      delta: deltas.views,
    },
    {
      key: "engagement",
      bg: "/Intersect4.svg",
      icon: "/chart.svg",
      title: "Avg Engagement Rate",
      valueEl: (
        <div className="-mt-1 font-lexend font-medium text-[36px] sm:text-[46px] lg:text-[58px] leading-[136%] text-[#301B69] text-left">
          {stats.engagement.toFixed(1)}%
        </div>
      ),
      delta: 0.2,
      deltaSuffix: " from baseline",
    },
  ] as const;

  const renderCard = (c: (typeof CARDS)[number]) => (
    <GlassCard key={c.key} bgSrc={c.bg}>
      <IconBadge src={c.icon} alt={c.title} />
      {c.valueEl}
      <div className="mt-1 font-inter font-medium text-[14px] sm:text-[16px] lg:text-[18px] leading-[136%] text-[#6E59A6] text-left">
        {c.title}
      </div>
      <StatDelta value={c.delta} suffix={c.deltaSuffix ?? " this minute"} />
    </GlassCard>
  );

  return (
    <div
      className="
        w-full
        min-h-[520px] sm:min-h-[620px] lg:min-h-[760px]
        rounded-3xl
        flex items-center justify-center
        px-4 sm:px-6 md:px-8
        py-10 sm:py-12 lg:py-14
        overflow-x-clip
      "
      style={{
        background: `
          linear-gradient(to bottom, #ffffff 0%, rgba(255,255,255,0) 15%),
          radial-gradient(120% 120% at 20% 20%, #f7f5ff 0%, #efeaff 35%, #fdfbff 70%, #ffffff 100%)
        `,
      }}
    >
      <div className="flex flex-col items-center w-full">
        {/* Live badge */}
        <div className="mb-4 sm:mb-6 flex items-center">
          <div className="flex flex-row items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 w-auto h-[32px] sm:h-[36px] bg-white/25 shadow-sm backdrop-blur-sm rounded-full">
            <img src="/live.svg" alt="Live" className="h-3 w-3" />
            <span className="font-inter font-medium text-[12px] sm:text-[14px] leading-[140%] text-[#301B69]">
              Live stats
            </span>
          </div>
        </div>

        {/* Heading + sub */}
        <h1 className="text-center font-lexend font-normal text-[28px] sm:text-[36px] lg:text-[48px] leading-[120%] tracking-[-0.02em] text-[#301B69]">
          Real-Time Impact
        </h1>
        <p className="mt-2 sm:mt-3 max-w-[66ch] text-center font-inter font-normal text-[14px] sm:text-[16px] md:text-[18px] leading-[136%] text-[#301B69] px-2">
          Watch our platform generate results in real time. These numbers update
          live as your users create and share content.
        </p>

        {/* ---- Mobile stacked (left/right alternating) ---- */}
        <motion.div
          className="mt-8 sm:hidden flex flex-col gap-6 w-full"
          variants={listStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
        >
          {CARDS.map((c, i) => {
            const side: "left" | "right" = i % 2 === 0 ? "left" : "right";
            return (
              <motion.div
                key={`m-${c.key}`}
                variants={slideItem}
                custom={side}
                className={`flex ${side === "left" ? "justify-start" : "justify-end"} w-full`}
              >
                {renderCard(c)}
              </motion.div>
            );
          })}
        </motion.div>

        {/* ---- Tablet/desktop grid (unchanged) ---- */}
        <motion.div
          className="
            mt-8 sm:mt-10 hidden sm:grid
            grid-cols-2 lg:grid-cols-4 gap-6
            justify-center justify-items-center
          "
          variants={listStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
        >
          {CARDS.map((c) => (
            <motion.div key={`d-${c.key}`} variants={slideItem} custom={"left"}>
              {renderCard(c)}
            </motion.div>
          ))}
        </motion.div>

        {/* Footer note */}
        <div className="mt-8 sm:mt-10 text-center text-xs sm:text-sm text-slate-500">
          Statistics update every <span className="font-semibold">3 seconds</span>. Last
          update: <span className="font-semibold">{lastUpdate}</span>
        </div>
      </div>
    </div>
  );
}
