"use client";

const LOGOS = [
  { src: "/logos/microsoft.svg", alt: "Microsoft", width: 164, height: 48 },
  { src: "/logos/notion.svg",    alt: "Notion",    width: 129, height: 48 },
  { src: "/logos/google.svg",    alt: "Google",    width: 113, height: 48 },
  { src: "/logos/slack.svg",     alt: "Slack",     width: 121, height: 48 },
  { src: "/logos/square.svg",    alt: "Square",    width: 132, height: 48 },
  { src: "/logos/zoom.svg",      alt: "Zoom",      width: 98,  height: 98 },
];

export default function TrustedBy() {
  return (
    <section
      aria-label="Trusted by"
      className="
        relative w-full
        border-t border-white/40
        bg-gradient-to-b from-white to-[#F7F7FB]
        flex items-center
      "
    >
      <div className="pointer-events-none absolute inset-x-0 bg-gradient-to-b from-white to-transparent" />

      <div
        className="
          mx-auto w-full max-w-[1360px] h-[144px]
          px-[48px]
          flex items-center justify-between
        "
      >
        {LOGOS.map((logo) => (
          <div
            key={logo.alt}
            className="flex items-center justify-center opacity-90 grayscale-[20%] shrink-0"
            title={logo.alt}
          >
           
            <img
              src={logo.src}
              alt={logo.alt}
              width={logo.width}
              height={logo.height}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-12 w-auto select-none"
              style={{ aspectRatio: `${logo.width} / ${logo.height}` }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
