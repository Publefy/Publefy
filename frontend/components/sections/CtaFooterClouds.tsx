"use client";

import { useRouter } from "next/navigation";

export default function CtaFooterClouds() {
  const router = useRouter();

  const handleGetStarted = () => router.push("/?auth=login");

  const links = {
    quick: ["Home", "User Stories", "FAQ", "Support", "Blog"],
    support: ["Help Center", "Getting Started", "Contact Support"],
  };

  const contact = [
    { icon: MailIcon, label: "nclark@junzitechsolutions.com" },
    { icon: PhoneIcon, label: "6174076181" },
    { icon: MapPinIcon, label: "Austin TX" },
  ];

  const socials = [
    { icon: TwitterIcon, label: "Twitter", url: "https://x.com/Publefy" },
    { icon: InstagramIcon, label: "Instagram", url: "https://www.instagram.com/publefy/" },
  ];

  return (
    <section className="w-full p-0 relative z-10">
      <div
        className="
          relative overflow-visible md:overflow-hidden min-h-[906px] h-auto md:h-[906px]  
          bg-[linear-gradient(229.14deg,#F2EFFF_-7.04%,#FFF1FE_121.07%)]
          isolation isolate
        "
      >
        {/* top overlay fade  */}
        <div
          className="pointer-events-none absolute top-0 left-0 right-0 h-[280px] z-0"
          style={{
            background:
              "linear-gradient(180deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)",
          }}
        />

        {/* Clouds (above overlay, below content) */}
        <img
          src="/Cloud_left.svg"
          alt=""
          className="pointer-events-none absolute top-[40%] -left-20 w-[280px] -translate-y-1/2 opacity-70 blur-[2px] select-none z-[1]"
        />
        <img
          src="/Cloud_bottom_right.svg"
          alt=""
          className="pointer-events-none absolute top-[48%] right-0 w-[520px] -translate-y-1/2 opacity-75 blur-[1px] select-none z-[1]"
        />

        {/* CTA content */}
        <div className="relative z-[2] text-center pt-14 px-6 top-[64px]">
          {/* pill badge */}
          <div className="inline-flex  items-center gap-2 rounded-full border border-[#E9E1FF] bg-white/70 px-4 py-1.5 text-xs md:text-sm font-medium text-[#5E3AF7] shadow-[0_6px_18px_rgba(94,58,247,0.10)] backdrop-blur">
            <span>Take Your Meme Creation to the Next Level</span>
          </div>

          {/* headline */}
          <h1
            className="
              mt-7
              text-[40px] md:text-[72px] lg:text-[84px]
              font-semibold leading-[1.05] tracking-tight
              text-transparent bg-clip-text
              bg-[linear-gradient(182.28deg,#301B69_36.46%,#B07CD1_97.83%)]
            "
          >
            Ready to Go Viral?
          </h1>

          {/* subcopy */}
          <p className="mx-auto mt-4 max-w-3xl text-[15px] md:text-[18px] leading-relaxed text-[#3B2C66]/85">
            Join thousands of creators and brands already using PubleFy to turn
            videos into viral memes and skyrocket engagement.
          </p>

          {/* CTA button */}
          <div className="mt-8 ">
            <button
              className="shimmer1
                group inline-flex items-center justify-center gap-2
                rounded-[18px]
                px-7 md:px-9 py-4 text-base md:text-lg font-semibold
                bg-[linear-gradient(180deg,#3C2A8B_0%,#2B1A69_100%)]
                text-white
                shadow-[0_10px_30px_rgba(60,42,139,0.45),inset_0_1px_0_rgba(255,255,255,0.25)]
                ring-1 ring-white/20
                hover:translate-y-[-2px] active:translate-y-[0px]
                transition-transform
              "
              onClick={handleGetStarted}        
            >
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
            </button>

            {/* subtle button glow underlay */}
            <div className="mx-auto mt-3 h-5 w-[220px] rounded-full bg-gradient-to-r from-transparent via-[#5C46D5]/30 to-transparent blur-lg" />
          </div>
        </div>

        {/* Footer grid */}
        <div className="relative z-[2] mt-16 px-6 md:px-10 pb-10 md:top-[64px]">
          <div className="mx-auto max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 sm:gap-8 items-start text-[#2a145a] overflow-visible">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <img src="/logo-marker.png" alt="Publefy" className="h-[48px] w-auto" />
            </div>

            {/* Quick Links */}
            <FooterCol title="Quick Links" items={links.quick} />
            {/* Support */}
            <FooterCol title="Support" items={links.support} />

            {/* Contact */}
            <div>
              <div className="mb-3 text-sm font-semibold">Contact Us</div>
              <ul className="space-y-2 text-sm text-[#2a145a]/80">
                {contact.map(({ icon: Icon, label }, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 text-[#7C7EF4] flex-shrink-0" />
                    <span className="whitespace-pre-line">{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Social */}
            <div>
              <div className="mb-3 text-sm font-semibold">Social</div>
              <div className="flex items-center gap-3">
                {socials.map(({ icon: Icon, label, url }, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid h-9 w-9 place-items-center rounded-full bg-[#5B3FF6] text-white shadow-[0_6px_16px_rgba(74,54,190,0.35)] hover:bg-[#6D4FFF] transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="mt-[90px] mx-auto max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px] px-6 md:px-10">
            <div className="h-px w-full bg-[#2a145a]/10" />
          </div>

          {/* Copyright */}
          <div className="mx-auto max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px] px-6 md:px-10">
          <p className="text-center py-6 text-xs text-[#2a145a]/60">
              © 2025 Publefy. All rights reserved.
          </p>
          </div>
        </div>

        {/* bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#EEE3FF] z-[1]" />
      </div>
    </section>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="w-full max-w-full overflow-visible">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <ul className="space-y-2 text-sm text-[#2a145a]/80">
        {items.map((t) => (
          <li key={t} className="overflow-visible">
            <a href="#" className="hover:underline inline-block">
              {t}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArrowRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/* ---------- Icons ---------- */
function MailIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 4h16v16H4z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}
function PhoneIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92V21a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3 5.18 2 2 0 0 1 5 3h4.09a2 2 0 0 1 2 1.72l.57 3.41a2 2 0 0 1-.57 1.82L9.91 12a16 16 0 0 0 6.18 6.18l2.05-1.18a2 2 0 0 1 1.82-.57l3.41.57A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
function MapPinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
function FacebookIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-3h2.5V9.5A3.5 3.5 0 0 1 14 6h3v3h-3c-.3 0-.5.2-.5.5V12H17l-.5 3h-2.5v7A10 10 0 0 0 22 12z" />
    </svg>
  );
}
function TwitterIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M22 5.8c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.2 1.7-2.1-.7.5-1.6.8-2.5 1A3.9 3.9 0 0 0 12 8.8a11 11 0 0 1-8-4.1A4 4 0 0 0 5.7 10c-.6 0-1.3-.2-1.8-.5 0 2 1.4 3.7 3.2 4-.6.2-1.2.2-1.8.1.5 1.6 2 2.8 3.8 2.8A7.9 7.9 0 0 1 2 18.6 11.2 11.2 0 0 0 8.1 20c7.8 0 12.1-6.5 12.1-12.1v-.6c.8-.5 1.5-1.2 1.8-2.1z" />
    </svg>
  );
}
function LinkedinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM2 22h8V8H2v14Zm12 0h8v-8c0-4-2-6-5-6s-4 2-4 2V8h-7v14h8Z" />
    </svg>
  );
}
function YoutubeIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23 7.5a4.5 4.5 0 0 0-3.2-3.2C17.5 4 12 4 12 4s-5.5 0-7.8.3A4 4 0 0 0 1 7.5 46 46 0 0 0 0 12a46 46 0 0 0 1 4.5 4.5 4.5 0 0 0 3.2 3.2C6.5 20 12 20 12 20s5.5 0 7.8-.3a4 5 5 0 0 0 3.2-3.2A46 46 0 0 0 24 12a46 46 0 0 0-1-4.5ZM9.8 15.5v-7L16 12l-6.2 3.5Z" />
    </svg>
  );
}
function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5Zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5Zm5.8-3.3a1.2 1.2 0 1 1-1.7 1.7 1.2 1.2 0 0 1 1.7-1.7Z" />
    </svg>
  );
}
