"use client";

import { useMemo } from "react";

export default function Testimonials() {
  const rows = [
    [
      {
        quote:
          "MemeFlow is a game-changer! I can turn a video into 5 different meme formats in seconds. My engagement literally doubled.",
        name: "Tyra Dhillon",
        role: "Software Tester",
        initials: "TD",
      },
      {
        quote:
          "Hands down the best meme tool I've ever used. The AI captions are so funny, it feels like I have a comedy writer on my team.",
        name: "Marvin McKinney",
        role: "Team Leader",
        initials: "MM",
      },
      {
        quote:
          "I was wasting hours editing manually. Now I just upload and post. It's like having a factory on autopilot.",
        name: "Courtney Henry",
        role: "UI/UX Designer",
        initials: "CH",
      },
      {
        quote:
          "Perfect for my brand's socials! The auto-posting + trending template suggestions keep us relevant every single day.",
        name: "Marx Hershey",
        role: "Scrum Master",
        initials: "MH",
      },
    ],
    [
      {
        quote:
          "I run a meme marketing agency and MemeFlow boosted productivity 10x. We can serve more clients without burning out.",
        name: "Kathryn Murphy",
        role: "Marketing Coordinator",
        initials: "KM",
      },
      {
        quote:
          "As a small business owner, I love how easy it is to create memes that actually connect with my audience. Huge ROI.",
        name: "Annette Black",
        role: "President of Sales",
        initials: "AB",
      },
      {
        quote: "The AI captions are spot-on. It feels like magic every time.",
        name: "Brooklyn Simmons",
        role: "Content Strategist",
        initials: "BS",
      },
      {
        quote:
          "Scheduling + templates = stress-free campaigns for my clients.",
        name: "Alex Johnson",
        role: "Agency Owner",
        initials: "AJ",
      },
    ],
  ];

  return (
    <section className="w-full mx-auto px-3 md:px-7 lg:px-[24px] py-[24px] max-w-[1920px]">
      <div className="relative mx-auto overflow-hidden rounded-[36px] border border-white/60 bg-[linear-gradient(124.5deg,#E3EBFF_8.9%,#EFFFED_140.17%)] max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]">
        {/* header */}
        <div className="px-6 md:px-12 pt-10 md:pt-12">
          <div className="mb-6 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#DDE6FA] bg-white/80 px-3.5 py-1.5 text-xs font-medium text-[#2e1a67] shadow-[0_6px_18px_rgba(64,36,143,0.12)] backdrop-blur">
              {/* SVG as img */}
              <img
                src="/star.svg"
                alt="Spark icon"
                className="h-4 w-4"
                draggable={false}
              />
              Testimonials
            </span>
          </div>

          {/* Heading */}
          <h2 className="w-full max-w-[1232px] mx-auto text-center font-lexend font-normal text-[48px] leading-[120%] tracking-[-0.02em] text-[#301B69]">
            Used by More Than 100k+ People
          </h2>

          {/* Subheading */}
          <p className="mt-3 w-full max-w-[1232px] mx-auto text-center font-inter font-normal text-[18px] leading-[136%] text-[#301B69]">
            Hear what meme-makers, marketers, and brands say about MemeFlow.
          </p>
        </div>

        <div className="mt-[60px] mb-[64px]" />

        {/* two auto-scrolling rows */}
        <div className="relative px-0 pb-12 md:pb-14">
          {/* edge masks */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#EAF3FF] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#EAF3FF] to-transparent" />

          <div className="space-y-6">
            {rows.map((items, idx) => (
              <MarqueeRow
                key={idx}
                items={items}
                reverse={idx % 2 === 1}
                speed={60}
              />
            ))}
          </div>
        </div>

        {/* decorative cutouts */}
        <div className="pointer-events-none absolute -left-6 -top-6 h-12 w-12 rounded-full bg-[#EAF3FF]" />
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-12 w-12 rounded-full bg-[#EAF3FF]" />
      </div>

      {/* marquee styles */}
      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        @keyframes marqueeReverse {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0);
          }
        }
        .marquee {
          animation: marquee var(--duration, 60s) linear infinite;
        }
        .marquee-reverse {
          animation: marqueeReverse var(--duration, 60s) linear infinite;
        }
      `}</style>
    </section>
  );
}

function MarqueeRow({
  items,
  reverse = false,
  speed = 60,
}: {
  items: Array<{ quote: string; name: string; role: string; initials: string }>;
  reverse?: boolean;
  speed?: number;
}) {
  const doubled = useMemo(() => [...items, ...items], [items]);

  return (
    <div className="relative overflow-hidden">
      <div className="flex w-[200%] gap-4 sm:gap-6">
        <div
          className={`${reverse ? "marquee-reverse" : "marquee"} flex min-w-max gap-4 sm:gap-6`}
          style={{ "--duration": `${speed}s` } as React.CSSProperties}
        >
          {doubled.map((c, i) => (
            <TestimonialCard
              key={`${c.name}-${i}`}
              {...c}
              widthClass="w-[300px] sm:w-[360px] md:w-[420px]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function TestimonialCard({
  quote,
  name,
  role,
  initials,
  widthClass,
}: {
  quote: string;
  name: string;
  role: string;
  initials: string;
  widthClass?: string;
}) {
  return (
    <div
      className={`${widthClass} relative shrink-0 rounded-2xl border border-[#E4E9F8] bg-white/95 p-5 backdrop-blur`}
    >
      {/* stars */}
      <div className="mb-3 flex gap-1 text-[#5C63E6]">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        ))}
      </div>

      {/* Quote */}
      <p className="w-full max-w-full h-[100px] font-inter font-normal text-[18px] leading-[136%] text-[#301B69]">
        {quote}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#F2F6FF] to-[#E7ECFF] text-[12px] font-semibold text-[#2A2F55] ring-1 ring-white/80">
          {initials}
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[#1F2A4A]">{name}</div>
          <div className="text-[12px] text-[#6A7390]">{role}</div>
        </div>
      </div>
    </div>
  );
}
