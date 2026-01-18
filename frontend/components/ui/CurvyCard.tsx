"use client";

type Props = {
  value: string;
  label: string;
  delta?: string;
  icon?: React.ReactNode;
};

export default function CurvyCard({ value, label, delta = "+2 this minute", icon }: Props) {
  return (
    <div className="relative h-[220px] w-[220px]">
      {/* SVG background + border */}
      <svg className="absolute inset-0" viewBox="0 0 440 440" preserveAspectRatio="none" aria-hidden>
        {/* Soft gradient fill */}
        <defs>
          <linearGradient id="fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="70%" stopColor="#efe9ff" />
            <stop offset="100%" stopColor="#f7f2ff" />
          </linearGradient>
          {/* Glow for the stroke */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1ea2ff"/>
            <stop offset="100%" stopColor="#3b82f6"/>
          </linearGradient>
        </defs>

        {/* The “squircle-ish” path (asymmetric, like the screenshot). 
           You can tweak the numbers to exaggerate corners. */}
        <path
          d="M70,30
             C165,10 275,12 360,40
             C400,55 410,95 410,145
             C410,260 408,310 360,360
             C320,402 255,410 180,410
             C125,410 95,408 70,385
             C35,352 30,315 30,235
             C30,165 30,120 45,90
             C55,70 60,50 70,30 Z"
          fill="url(#fill)"
        />
        <path
          d="M70,30
             C165,10 275,12 360,40
             C400,55 410,95 410,145
             C410,260 408,310 360,360
             C320,402 255,410 180,410
             C125,410 95,408 70,385
             C35,352 30,315 30,235
             C30,165 30,120 45,90
             C55,70 60,50 70,30 Z"
          fill="none"
          stroke="url(#stroke)"
          strokeWidth="10"
          filter="url(#glow)"
        />
      </svg>

      {/* Content */}
      <div className="relative z-10 h-full w-full p-5 flex flex-col">
        {/* icon pill */}
        <div className="h-9 w-9 rounded-2xl bg-white/70 backdrop-blur text-indigo-500 grid place-items-center shadow-sm">
          {icon ?? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v4m0 10v4M3 12h4m10 0h4M7 12a5 5 0 1 0 10 0A5 5 0 0 0 7 12Z"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </div>

        <div className="mt-4">
          <div className="text-4xl font-extrabold tracking-tight text-indigo-900">{value}</div>
          <div className="text-sm mt-1 text-indigo-700/80">{label}</div>
        </div>

        <div className="mt-auto self-end text-xs text-indigo-700/70">{delta}</div>
      </div>
    </div>
  );
}
