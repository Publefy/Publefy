"use client";

import { useState } from "react";
import { ArrowUpDown, Gift, Percent, Upload, Share2, HelpCircle, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "framer-motion";

export default function FaqWithClouds() {
  const items = [
    {
      q: "Can I upgrade or downgrade my plan at any time?",
      a: "Yes. You can change plans at any time and the new billing will prorate automatically for the remainder of your cycle.",
      icon: ArrowUpDown,
    },
    {
      q: "Is there a free trial available?",
      a: "Absolutely! Try PubleFy Free for 14 days. Generate memes, test integrations, and see how quickly you can go viral—no credit card required.",
      defaultOpen: true,
      icon: Gift,
    },
    {
      q: "Do you offer discounts for annual subscriptions?",
      a: "Yes, yearly plans come with a discount compared to paying monthly.",
      icon: Percent,
    },
    {
      q: "Can I use my own images or videos?",
      a: "Of course. Upload your own media or remix trending templates—your choice.",
      icon: Upload,
    },
    {
      q: "Which platforms can I post memes to?",
      a: "Schedule and auto-publish to Instagram, TikTok, X, Facebook, LinkedIn, and more.",
      icon: Share2,
    },
    {
      q: "What kind of support is available?",
      a: "Live chat, docs, and priority email for Pro/Agency plans.",
      icon: HelpCircle,
    },
  ];

  return (
    <section className="w-full min-h-[1016px] h-auto px-3 md:px-7 py-7 pb-14 md:pb-7">
      <div
        className="
          relative overflow-hidden rounded-[36px]
          border border-white/60
          bg-[linear-gradient(180deg,#F5E9FF_0%,#F4E7FF_22%,#F7EDFF_55%,#FBF3FF_100%)]
          isolation-isolate
        "
      >
        {/* bottom overlay fade (280px) — transparent -> white, no elevation */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[280px] z-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0) 0%, #FFFFFF 100%)",
          }}
        />

        {/* floating clouds (sit above overlay, below content) */}
        <img
          src="/Cloud_bottom_right.svg"
          alt=""
          className="pointer-events-none absolute -top-10 right-0 w-[220px] opacity-60 select-none z-[1]"
          aria-hidden
        />
        <img
          src="/Cloud_left.svg"
          alt=""
          className="pointer-events-none absolute top-[45%] -left-10 w-[200px] -translate-y-1/2 opacity-60 select-none z-[1]"
          aria-hidden
        />
        <img
          src="/Cloud_bottom_right.svg"
          alt=""
          className="pointer-events-none absolute bottom-[18%] right-0 w-[260px] opacity-65 select-none z-[1]"
          aria-hidden
        />

        {/* header */}
        <div className="relative z-[2] px-6 md:px-12 pt-12 text-center">
          {/* Badge: Frequently Asked Questions (Inter 14/140%, #301B69) */}
          <div className="mb-5 flex justify-center">
            <span className="
              inline-flex items-center gap-2 rounded-full
              border border-[#E8D7FB] bg-white/70
              px-4 py-2
              font-inter font-medium text-[14px] leading-[140%] text-[#301B69]
              shadow-[0_6px_18px_rgba(81,43,129,0.12)] backdrop-blur
            ">
              <img src="/Question.svg" alt="" className="h-4 w-4" />
              Frequently Asked Questions
            </span>
          </div>

          {/* Heading: Explore Common Questions About PubleFy (Lexend 48/120%, -0.02em, #301B69) */}
          <h2 className="
            mx-auto max-w-[664px]
            font-lexend font-normal text-[clamp(32px,5vw,48px)] leading-[120%] tracking-[-0.02em]
            text-[#301B69] text-center break-words
          ">
            Explore Common Questions About PubleFy
          </h2>

          {/* Subheading (Inter 18/136%, #301B69) */}
          <p className="
            mx-auto mt-3 max-w-[664px]
            font-inter font-normal text-[clamp(16px,2.5vw,18px)] leading-[136%]
            text-[#301B69] text-center
          ">
            Find answers to frequently asked questions about PubleFy. Learn about features, pricing, integrations,
            support, and how to start creating viral memes today.
          </p>
        </div>

        {/* FAQ list */}
        <div className="relative z-[2] mx-auto mt-8 mb-14 w-full max-w-[664px] px-4 md:px-0 space-y-4">
          {items.map((it, i) => (
            <FaqItem key={i} q={it.q} a={it.a} defaultOpen={!!it.defaultOpen} icon={it.icon} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------- Accordion item styled per card spec --------- */
function FaqItem({
  q,
  a,
  defaultOpen = false,
  icon: Icon,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const prefersReduced = useReducedMotion();

  return (
    <div
      className={`
        w-full rounded-[16px] border transition-all duration-300
        ${
          isOpen
            ? "border-[rgba(48,27,105,0.3)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(255,255,255,0.65)_100%)] shadow-[0_6px_20px_rgba(48,27,105,0.16),0_0_0_1px_rgba(124,126,244,0.15)]"
            : "border-[rgba(48,27,105,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.64)_0%,rgba(255,255,255,0.256)_100%)] shadow-[0_2px_8px_rgba(48,27,105,0.06)]"
        }
      `}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex w-full cursor-pointer items-center justify-between gap-3
          px-6 py-5 min-h-[96px] text-left
          transition-colors hover:bg-white/20
        "
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4 flex-1">
          {/* Icon */}
          {Icon && (
            <div className="flex-shrink-0">
              <Icon className="h-6 w-6 text-[#7C7EF4]" />
            </div>
          )}
          {/* Question text */}
          <span className="font-inter text-[16px] md:text-[17px] font-medium leading-[148%] text-[#301B69]">
            {q}
          </span>
        </div>

        {/* Chevron */}
        <motion.div
          animate={prefersReduced ? {} : { rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="flex-shrink-0"
        >
          <ChevronDown className="h-7 w-7 text-[#301B69]" />
        </motion.div>
      </button>

      {/* Answer text */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={prefersReduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={prefersReduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: prefersReduced ? 0.15 : 0.35, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6">
              <p className="font-inter font-normal text-[16px] leading-[148%] text-[#301B69] max-w-[608px]">
                {a}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
