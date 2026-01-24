"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Volume2, VolumeX } from "lucide-react";

// The reels uploaded by the user in /public/reels/
// Filenames may contain special characters like # or emojis, so we'll encode them.
const REEL_FILENAMES = [
  "#reels #memes #relatable #couple.mp4",
  "🎬 André the Giant2018 ‧ Documentary-Sport ‧ 1h 25m 📜 StorylineThis documentary tells the real .mp4",
  "🎬 Godzilla vs. Kong2021 ‧ Action-Sci‑fi ‧ 1h 53m 📜 StorylineIn this massive monster showdown, .mp4",
  "🎬 The Boys2019 ‧ Action-Drama ‧ 4 seasons📜 StorylineIn a world where superheroes are idolized .mp4",
  "🫡#youngfounder #capitalism #business #cofound #success #money #startup #taxes #investing.mp4",
  "bank-mem_#funfacts #funfactory #reelz.mp4",
  "bank-mem_biotech_pulse 2025-04-02T215348.mp4",
  "bank-mem_camgoodfitness 2025-05-14T214647.mp4",
  "bank-mem_edgyplus 2025-07-07T163056.mp4",
  "bank-mem_fn_sols 2025-05-31T200921.mp4",
  "bank-mem_frHeath Ledger was an Australian actor renowned for his exceptional talent and versatility in a .mp4",
  "bank-mem_fried_rice_syndrome 2025-03-04T143622.mp4",
  "bank-mem_gymparty_meme 2025-04-20T000623.mp4",
  "bank-mem_ian_byington 2025-03-06T060002.mp4",
  "bank-mem_ibmadeeasier 2025-08-07T193635.mp4",
  "bank-mem_liftsago 2025-06-28T163656.mp4",
  "Context - OpenAI has become one of the most aggressively valued companies in history. As of late.mp4",
  "Founders can relate heavy#founder #startup #startups #startupfounder #entrepreneurmind.mp4",
  "im proud as f🤬ck.mp4",
  "SaveClip.App_AQNBMFc1fdYVbRwzbZHRKDnx97vHRdr3k52OZ3vo3jlBW5hTYrVoIsUhq_o2n9XcGq4128x-_uBym_Wy3EFnbPc9ZNXN_MiSCwP9wvg.mp4",
  "SaveClip.App_AQNhRIwmlQvoDj7fCvV7IxdZltZ3QnZipifIGBSvdFtrf2c4X6su9PFnkkt_WXwrLlwcmYmnfGWqwni6kGzguBEKxMvQ4Iikgm0D3zk.mp4",
  "SaveClip.App_AQNzeaeYJcqDs8Xz0-rLBBYbVSHcA7CSoU0KsK9fFnFjWQ0AHyL078jH7I5Bh6bNI4e5j9s__90G_hzT9xJ1RW8CRiN4ukmb2PdGTvU.mp4",
  "SaveClip.App_AQOXdZGJVMoSjIhT26RGDKTzTWbYZlLcd0jI9sNes2CmleTQBLtv8H5w_ei_M1KN-G6D8XyHlBFsupXIClzKnCXhrAAiY29aVYp61N8.mp4",
  "That one IT friend juggling 4 jobs, 12 Zoom calls, and 0 hours of sleep. #TechLife #RemoteWork #.mp4",
  "video (1).mp4",
  "video.mp4",
];

const REELS_LIST = REEL_FILENAMES.map((filename, i) => ({
  id: i + 1,
  // We MUST encode the filename because characters like # are treated as fragments
  url: `/reels/${filename.split('/').map(part => encodeURIComponent(part)).join('/')}`
}));

export default function MemeMarquee() {
  const [isPaused, setIsPaused] = useState(false);

  return (
    <div className="w-full bg-transparent py-12 md:py-20 overflow-hidden select-none relative z-50">
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee-content {
          display: flex;
          width: max-content;
          animation: marquee 120s linear infinite;
        }
        .marquee-content.paused {
          animation-play-state: paused;
        }
      `}</style>
      
      <div 
        className="relative flex hover:cursor-pointer"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Infinite Loop Container */}
        <div className={cn("marquee-content gap-4 px-2", isPaused && "paused")}>
          {/* We duplicate the list to create the infinite effect */}
          {[...REELS_LIST, ...REELS_LIST].map((reel, idx) => (
            <MemeCard key={`${reel.id}-${idx}`} reel={reel} />
          ))}
        </div>

        {/* Gradient Fades on edges to make it feel more premium */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-white via-white/40 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white via-white/40 to-transparent z-10" />
      </div>

      <div className="mt-8 text-center">
        <p className="text-[#301B69]/40 text-sm font-medium animate-pulse">
            Hover to stop and unmute
        </p>
      </div>
    </div>
  );
}

function MemeCard({ reel }: { reel: typeof REELS_LIST[0] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current) {
      videoRef.current.muted = false;
      setIsMuted(false);
      // Ensure it's playing
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  return (
    <div 
      className={cn(
        "relative w-[160px] h-[280px] sm:w-[200px] sm:h-[350px] md:w-[240px] md:h-[420px] rounded-[24px] overflow-hidden shadow-sm transition-all duration-500 ease-out",
        "bg-white/10 backdrop-blur-sm border border-[#301B69]/5 flex-shrink-0",
        isHovered ? "scale-[1.08] z-30 shadow-2xl border-[#7C7EF4]/40" : "scale-100 z-0"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {reel.url ? (
        <video
          ref={videoRef}
          src={reel.url}
          className="w-full h-full object-cover"
          loop
          muted
          playsInline
          autoPlay
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-100 to-white text-[#301B69]/60 p-4 text-center">
            <div className="relative z-10">
                <div className="w-12 h-12 rounded-full bg-[#7C7EF4]/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
                    <svg className="w-6 h-6 text-[#7C7EF4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <span className="text-xs font-bold tracking-wide uppercase">Meme Reel #{reel.id}</span>
                <p className="text-[10px] mt-1 text-[#301B69]/40">Ready for upload</p>
            </div>
        </div>
      )}

      {/* Audio Status Indicator */}
      {isHovered && (
        <div className="absolute top-4 right-4 bg-[#301B69]/80 backdrop-blur-md rounded-full p-2 text-white z-30 shadow-lg">
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} className="animate-pulse" />}
        </div>
      )}
      
      {/* Premium Overlay */}
      <div className={cn(
        "absolute inset-0 transition-all duration-500 pointer-events-none",
        isHovered ? "bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-100" : "opacity-0"
      )} />
      
      {/* Subtle Border Glow when hovered */}
      {isHovered && (
        <div className="absolute inset-0 rounded-[24px] ring-2 ring-[#7C7EF4]/50 ring-inset pointer-events-none" />
      )}
    </div>
  );
}
