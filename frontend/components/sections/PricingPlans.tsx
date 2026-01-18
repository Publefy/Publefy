"use client";

import { useState } from "react";
import Sparkle from "@/public/Sparkle.svg";
import CheckCircle from "@/public/Check Circle.svg";
import { useRouter } from "next/navigation";

export default function PricingPlans() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section className="w-full mx-auto px-3 md:px-7 py-7 max-w-[1920px]">
      {/* page bg */}
      <div className="rounded-[56px]">
        <div className="mx-auto rounded-[56px] bg-[linear-gradient(201.17deg,#F5E6FF_-4.98%,#FFF4EA_119.25%)] p-6 md:p-16 max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]">
          {/* header */}
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-5 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border
               border-[#E7E5F7] bg-white/90 px-3.5 py-1.5 text-[12px]
                font-medium text-[#2C1B68] ">
                <svg
                  width="16"
                  height="16"
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

            <h2 className="mx-auto max-w-[600px] text-[clamp(28px,6vw,44px)] font-semibold leading-[1.1] tracking-tight text-[#2C136F] break-words">
              Simple, Transparent Plan and Pricing
            </h2>
            <p className="mt-3 text-sm text-[#3B2E76]/75">
              Choose the plan that's right for you. Pay-as-you-go options available after reaching limits.
            </p>

            {/* Monthly/Yearly Toggle */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <span className={`text-sm font-medium transition-colors duration-200 ${!isYearly ? "text-[#2C136F]" : "text-[#7A75A5]"}`}>
                Monthly
              </span>
              <button
                type="button"
                onClick={() => setIsYearly(!isYearly)}
                className="relative h-8 w-14 rounded-full bg-[#E7E5F7] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#7C7EF4] focus:ring-offset-2"
                aria-label={isYearly ? "Switch to monthly billing" : "Switch to yearly billing"}
                role="switch"
                aria-checked={isYearly}
              >
                <span
                  className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-transform duration-[220ms] ease-in-out ${
                    isYearly ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium transition-colors duration-200 ${isYearly ? "text-[#2C136F]" : "text-[#7A75A5]"}`}>
                Yearly
                <span className="ml-2 inline-flex items-center rounded-full bg-[#7C7EF4]/10 px-2 py-0.5 text-xs font-semibold text-[#7C7EF4]">
                  2 months free
                </span>
              </span>
            </div>
          </div>

          {/* cards */}
          <div className="mx-auto mt-10 grid max-w-[1400px] gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                "10 videos/month included",
                "Pay-as-you-go after limit",
              ]}
              variant="light"
              stripeUrl="https://buy.stripe.com/7sYcN45Zl7uz5Gs3pqdAk01"
            />

            <PriceCard
              badge="For Growing"
              title="Entry"
              monthlyPrice="$29"
              yearlyPrice="$290"
              yearlySavings="$58"
              isYearly={isYearly}
              features={[
                "3 accounts connected",
                "Scheduling included",
                "30 videos/month included",
                "Pay-as-you-go after limit",
              ]}
              variant="light"
              stripeUrl="https://buy.stripe.com/3cI14m9bx2afd8Uf88dAk02"
            />

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
                "90 videos/month included",
                "Pay-as-you-go after limit",
              ]}
              variant="light"
              prominent
              highlighted
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
          </div>

          {/* Pay-as-you-go note */}
          <div className="mt-12 text-center border-t border-[#E7E5F7] pt-8">
            <p className="text-sm text-[#3B2E76]/70">
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
        "relative flex min-h-[520px] flex-col rounded-[22px] border p-7 shadow-[0_10px_30px_rgba(27,13,63,0.08)] backdrop-blur transition-all duration-500",
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#6A6396] whitespace-nowrap opacity-80">{badge}</span>

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

      <h3 className="text-[28px] font-semibold text-[#231A69]">{title}</h3>

      {/* price */}
      <div className="mt-5">
        <div className="flex items-end gap-2 min-h-[44px]">
          <span className={`${isCustom ? "text-[24px]" : "text-[44px]"} font-semibold leading-none text-[#2B1470]`}>
            {isCustom ? "Talk to Sales" : currentPrice}
          </span>
          {!isCustom && <span className="mb-1 text-sm text-[#7A75A5]">{currentPeriod}</span>}
        </div>
        {isYearly && !isCustom && (
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#7C7EF4]/10 px-2 py-1 text-xs font-semibold text-[#7C7EF4]">
              Save {yearlySavings}/yr
            </span>
            <span className="text-xs text-[#7A75A5]">Billed yearly</span>
          </div>
        )}
      </div>

      {/* divider */}
      <div className="my-5 h-px bg-gradient-to-r from-transparent via-[#EEEAFB] to-transparent" />

      {/* features */}
      <div className="space-y-3">
        <div className="text-[13px] font-semibold text-[#2E235F]">What's included</div>
        <ul className="mt-2 space-y-3">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-3 text-[14px] text-[#433F63]">
              <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full bg-white shadow-[0_4px_10px_rgba(27,13,63,0.12)] ring-1 ring-[#ECE9FF]">
                <img
                  src={CheckCircle.src}
                  alt=""
                  width={18}
                  height={18}
                  className="w-[18px] h-[18px] select-none"
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
      <div className="mt-auto pt-6">
        {highlighted ? (
          // Purple button only for Pro
          <button className="shimmer1 inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#2A1D60] bg-[#3B2E76] text-white shadow-[0_10px_26px_rgba(37,18,102,0.28)] transition-transform hover:scale-[1.01] active:scale-[.99]" onClick={handleGetStarted}>
            <span className="relative -top-px">Get Started</span>
          </button>
        ) : (
          // Default white button
          <button className="group relative inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#E6E2F9] bg-white text-[#2B1470] shadow-[0_8px_22px_rgba(27,13,63,0.10)] transition-transform hover:scale-[1.01] active:scale-[.99]" onClick={isCustom ? () => window.open("https://calendar.app.google/PPFeknvdixs6ANhw7", "_blank") : handleGetStarted}>
            <span className="pointer-events-none absolute inset-0 rounded-2xl shadow-[inset_0_1px_0_#FFFFFF,inset_0_-2px_6px_rgba(0,0,0,0.04)]" />
            <span className="relative -top-px">{isCustom ? "Contact Sales" : "Get Started"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
