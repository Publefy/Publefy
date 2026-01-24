"use client";

import { useState } from "react";
import Sparkle from "@/public/Sparkle.svg";
import CheckCircle from "@/public/Check Circle.svg";
import { useRouter } from "next/navigation";

export default function PricingPlans() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="w-full mx-auto px-3 md:px-7 py-4 sm:py-5 md:py-6 max-w-[1920px]">
      {/* page bg */}
      <div className="rounded-[40px]">
        <div className="mx-auto rounded-[40px] bg-[linear-gradient(201.17deg,#F5E6FF_-4.98%,#FFF4EA_119.25%)] p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]">
          {/* header */}
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-2 sm:mb-3 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border
               border-[#E7E5F7] bg-white/90 px-2.5 py-1 text-[10px]
                font-medium text-[#2C1B68] ">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-[#6E6FF2]"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <line x1="7" y1="8" x2="17" y2="8" />
                  <line x1="7" y1="12" x2="13" y2="12" />
                </svg>
                Pricing
              </span>
            </div>

            <h2 className="mx-auto max-w-[600px] text-[clamp(20px,4vw,32px)] font-semibold leading-[1.1] tracking-tight text-[#2C136F] break-words">
              Simple, Transparent Plan and Pricing
            </h2>
          </div>

          {/* cards */}
          <div className="mx-auto mt-3 sm:mt-4 md:mt-5 grid max-w-[500px] gap-3 sm:gap-4 grid-cols-1">
            <PriceCard
              badge="For Starters"
              title="Free"
              monthlyPrice="$0"
              yearlyPrice="$0"
              yearlySavings="$0"
              isYearly={isYearly}
              features={[
                "1 account connected",
                "Scheduling included",
                "16 videos/month included",
                "Pay-as-you-go after limit",
              ]}
              variant="light"
              stripeUrl="https://buy.stripe.com/7sYcN45Zl7uz5Gs3pqdAk01"
            />

            <PriceCard
              badge="For Growing"
              title="Entry"
              monthlyPrice="$19"
              yearlyPrice="$190"
              yearlySavings="$38"
              isYearly={isYearly}
              features={[
                "3 accounts connected",
                "Scheduling included",
                "100 videos/month included",
                "Pay-as-you-go after limit",
              ]}
              variant="light"
              stripeUrl="https://buy.stripe.com/3cI14m9bx2afd8Uf88dAk02"
              prominent
              highlighted
            />

            {/* Pro and Custom plans hidden from landing page */}
            {/*
            <PriceCard
              badge="For Professionals"
              title="Pro"
              monthlyPrice="$99"
              yearlyPrice="$990"
              yearlySavings="$198"
              isYearly={isYearly}
              features={[
                "10 accounts connected",
                "Scheduling included",
                "200 videos/month included",
                "Pay-as-you-go after limit",
              ]}
              variant="light"
              stripeUrl="https://buy.stripe.com/bJe4gy9bx4inb0M3pqdAk03"
            />

            <PriceCard
              badge="For Enterprise"
              title="Custom"
              monthlyPrice="Custom"
              yearlyPrice="Custom"
              yearlySavings="$0"
              isYearly={isYearly}
              features={[
                "Custom accounts & volume",
                "Dedicated SLA",
                "Priority onboarding",
                "Invoicing & custom terms",
              ]}
              variant="light"
            />
            */}
          </div>

          {/* Pay-as-you-go note */}
          <div className="mt-4 sm:mt-5 md:mt-6 text-center border-t border-[#E7E5F7] pt-3 sm:pt-4">
            <p className="text-[10px] sm:text-xs text-[#3B2E76]/70">
              <strong className="text-[#2C136F]">Pay-as-you-go:</strong> Need more videos? Once you reach your plan's limit, 
              you can continue generating videos with simple usage-based pricing. 
              Contact our team for specific rates and high-volume discounts.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Card ---------------- */

function PriceCard({
  badge,
  title,
  monthlyPrice,
  yearlyPrice,
  yearlySavings,
  isYearly,
  features,
  variant = "light",
  chip,
  prominent = false,
  highlighted = false,
  stripeUrl,
}: {
  badge: string;
  title: string;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlySavings: string;
  isYearly: boolean;
  features: string[];
  variant?: "light" | "dark";
  chip?: string;
  prominent?: boolean;
  highlighted?: boolean;
  stripeUrl?: string;
}) {
  const router = useRouter();

  const handleGetStarted = () => {
    if (stripeUrl) {
      window.open(stripeUrl, "_blank");
    } else {
      router.push("/?auth=login");
    }
  };

  const lightShell =
    "bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(250,248,255,0.96)_100%)] border-[#EBE7FC] ring-1 ring-white/50";

  const currentPrice = isYearly ? yearlyPrice : monthlyPrice;
  const currentPeriod = isYearly ? "/year" : "/month";
  const isCustom = monthlyPrice === "Custom";

  return (
    <div
      className={[
        "relative flex flex-col rounded-[16px] border p-4 sm:p-5 md:p-6 shadow-[0_10px_30px_rgba(27,13,63,0.08)] backdrop-blur transition-all duration-500",
        "min-h-[320px] sm:min-h-[360px] md:min-h-[380px]",
        lightShell,
        prominent ? "shadow-[0_16px_60px_rgba(37,18,102,0.18)]" : "",
        highlighted ? "ring-2 ring-[#7C7EF4]/30" : "",
      ].join(" ")}
    >
      {/* Minimalist Pulsating Background for Highlighted Card */}
      {highlighted && (
        <div className="absolute inset-0 -z-10 rounded-[22px] overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#F5E6FF]/60 via-[#7C7EF4]/10 to-[#FFF4EA]/60 animate-pulse-subtle" />
        </div>
      )}

      {/* top row */}
      <div className="mb-1 sm:mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-[#6A6396] whitespace-nowrap opacity-80">{badge}</span>

        {chip && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E5F7] bg-white px-2 py-1 text-[10px] font-bold text-[#2E1A67] shadow-[0_4px_12px_rgba(64,36,143,0.12)] whitespace-nowrap">
            <img
              src={Sparkle.src}
              alt=""
              width={10}
              height={10}
              className="w-[10px] h-[10px] select-none flex-shrink-0"
              loading="lazy"
              decoding="async"
              aria-hidden
              draggable={false}
            />
            {chip}
            <img
              src={Sparkle.src}
              alt=""
              width={10}
              height={10}
              className="w-[10px] h-[10px] select-none flex-shrink-0"
              loading="lazy"
              decoding="async"
              aria-hidden
              draggable={false}
            />
          </span>
        )}
      </div>

      <h3 className="text-[16px] sm:text-[18px] md:text-[20px] font-semibold text-[#231A69]">{title}</h3>

      {/* price */}
      <div className="mt-1.5 sm:mt-2">
        <div className="flex items-end gap-1 min-h-[24px] sm:min-h-[28px]">
          <span className={`${isCustom ? "text-[14px] sm:text-[16px]" : "text-[24px] sm:text-[28px]"} font-semibold leading-none text-[#2B1470]`}>
            {isCustom ? "Talk to Sales" : currentPrice}
          </span>
          {!isCustom && <span className="mb-0.5 text-[9px] sm:text-[10px] text-[#7A75A5]">{currentPeriod}</span>}
        </div>
        {isYearly && !isCustom && (
          <div className="mt-1 flex items-center gap-1">
            <span className="inline-flex items-center rounded-full bg-[#7C7EF4]/10 px-1 py-0.5 text-[9px] font-semibold text-[#7C7EF4]">
              Save {yearlySavings}/yr
            </span>
            <span className="text-[9px] text-[#7A75A5]">Billed yearly</span>
          </div>
        )}
      </div>

      {/* divider */}
      <div className="my-2 sm:my-2.5 h-px bg-gradient-to-r from-transparent via-[#EEEAFB] to-transparent" />

      {/* features */}
      <div className="space-y-1 sm:space-y-1.5">
        <div className="text-[10px] sm:text-[11px] font-semibold text-[#2E235F]">What's included</div>
        <ul className="mt-0.5 space-y-1 sm:space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-1.5 text-[10px] sm:text-[11px] text-[#433F63]">
              <span className="mt-0.5 grid h-3.5 w-3.5 sm:h-4 sm:w-4 place-items-center rounded-full bg-white shadow-[0_4px_10px_rgba(27,13,63,0.12)] ring-1 ring-[#ECE9FF]">
                <img
                  src={CheckCircle.src}
                  alt=""
                  width={18}
                  height={18}
                  className="w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] select-none"
                  loading="lazy"
                  decoding="async"
                  aria-hidden
                  draggable={false}
                />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="mt-auto pt-2 sm:pt-3">
        {highlighted ? (
          // Purple button only for Pro
          <button className="shimmer1 inline-flex min-h-[44px] h-9 sm:h-10 w-full items-center justify-center rounded-lg border border-[#2A1D60] bg-[#3B2E76] text-white text-xs sm:text-sm shadow-[0_10px_26px_rgba(37,18,102,0.28)] transition-transform hover:scale-[1.01] active:scale-[.99] touch-manipulation" onClick={handleGetStarted} aria-label="Get started with Publefy">
            <span className="relative -top-px">Get Started</span>
          </button>
        ) : (
          // Default white button
          <button className="group relative inline-flex min-h-[44px] h-9 sm:h-10 w-full items-center justify-center rounded-lg border border-[#E6E2F9] bg-white text-[#2B1470] text-xs sm:text-sm shadow-[0_8px_22px_rgba(27,13,63,0.10)] transition-transform hover:scale-[1.01] active:scale-[.99] touch-manipulation" onClick={isCustom ? () => window.open("https://calendar.app.google/PPFeknvdixs6ANhw7", "_blank") : handleGetStarted} aria-label={isCustom ? "Contact sales for custom pricing" : "Get started with Publefy"}>
            <span className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_1px_0_#FFFFFF,inset_0_-2px_6px_rgba(0,0,0,0.04)]" />
            <span className="relative -top-px">{isCustom ? "Contact Sales" : "Get Started"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
