"use client";

import React, { memo, type ReactNode, useEffect, useRef, useState } from "react";
import { UploadCloud, Flame, Link2, Share2, Sparkles, Type } from "lucide-react";
import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  Variants,
  MotionConfig,
} from "framer-motion";
import { VideoProcessorModal } from "@/components/video-processor-modal";

/* ---------- animation presets (lighter) ---------- */
// Framer Motion typing can be picky with cubic-bezier tuples; cast to any for brevity
const EASE: any = [0.22, 1, 0.36, 1];

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.02 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: EASE },
  },
};

const slideDown: Variants = {
  hidden: { opacity: 0, y: -14, scale: 0.995 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: EASE },
  },
};

const zoomIn: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: EASE },
  },
};

const slideLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: EASE } },
};

const slideRight: Variants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: EASE } },
};

export const requiredAssets = ["/star.svg"];

export default function SmartVideoProcessing() {
  const prefersReduced = useReducedMotion();
  const [processorOpen, setProcessorOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleOpenPicker = () => {
    inputRef.current?.click();
  };

  const acceptFile = (file?: File | null) => {
    if (!file) return;
    const MAX_BYTES = 20 * 1024 * 1024; // 20MB per UI
    if (!file.type.startsWith("video/")) {
      setFileError("Please select a video file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("File exceeds 20MB. Choose a smaller file.");
      return;
    }
    setFileError(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    acceptFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0] || null;
    acceptFile(file);
  };

  // If user just logged in with a resume flag, open the modal automatically
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const shouldResume = sessionStorage.getItem("resumeVideoProcessor");
      if (!shouldResume) return;
      // First open the modal
      setProcessorOpen(true);
      // Restore selected file from in-memory global (same-tab, no reload)
      try {
        const globalState: any = (window as any).__videoProcessorResume;
        const resumeFile: File | undefined = globalState?.file;
        if (resumeFile) {
          setSelectedFile(resumeFile);
          const url = URL.createObjectURL(resumeFile);
          setPreviewUrl((prev) => {
            if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return url;
          });
          setFileError(null);
        }
      } catch {}
      // Listen for explicit resume requests (e.g. from LandingPage)
      const onResumeRequest = () => setProcessorOpen(true);
      window.addEventListener("videoProcessor:resume-request", onResumeRequest);
      return () => window.removeEventListener("videoProcessor:resume-request", onResumeRequest);
    } catch {}
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation}>
        <section className="w-full mx-auto py-7 px-3 md:px-7 max-w-[1920px] min-[2000px]:py-16 min-[3000px]:py-20 min-[4000px]:py-24">
          {/* background container */}
          <m.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.3 }}
            variants={staggerContainer}
            className={`
              relative mx-auto w-full overflow-hidden
              rounded-[24px] border border-white/40
              bg-[linear-gradient(201.17deg,#F5E6FF_-4.98%,#FFF4EA_119.25%)]
              min-[3000px]:rounded-[28px] min-[4000px]:rounded-[32px]
              max-w-[1360px] min-[2000px]:max-w-[1600px] min-[3000px]:max-w-[1920px] min-[4000px]:max-w-[2200px]
            `}
          >
            {/* soft glows */}
            {!prefersReduced && (
              <>
                <m.div
                  aria-hidden
                  className={`
                    pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px]
                    -translate-x-1/2 rounded-full opacity-70
                    bg-[radial-gradient(closest-side,rgba(124,126,244,0.25),rgba(124,126,244,0)_70%)]
                  `}
                  animate={{
                    y: [0, -8, 0],
                    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                  }}
                />
                <m.div
                  aria-hidden
                  className={`
                    pointer-events-none absolute -right-24 -top-24 h-[360px] w-[360px]
                    rounded-full opacity-70
                    bg-[radial-gradient(closest-side,rgba(255,143,178,0.25),rgba(255,143,178,0)_70%)]
                  `}
                  animate={{
                    x: [0, 6, 0],
                    y: [0, -6, 0],
                    transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
                  }}
                />
              </>
            )}

            {/* centered content */}
            <div
              className={`
                mx-auto w-full max-w-[1200px] px-4 md:px-8
                min-[2000px]:max-w-[1400px]
                min-[3000px]:max-w-[1680px]
                min-[4000px]:max-w-[1960px]
              `}
            >
              <div
                className={`
                  relative grid gap-10 py-10 md:py-14
                  lg:grid-cols-[1.15fr_1fr]
                  min-[2000px]:gap-12 min-[3000px]:gap-16 min-[4000px]:gap-20
                  min-[2000px]:py-16 min-[3000px]:py-20 min-[4000px]:py-24
                `}
              >
                {/* Left column */}
                <div>
                  <m.div
                    variants={fadeUp}
                    className={`
                      inline-flex items-center gap-2 rounded-full border border-[#e7e5f7]
                      bg-white/80 px-4 py-2 text-sm text-[#2e1a67]
                      shadow-[0_6px_20px_rgba(64,36,143,0.08)]
                      min-[3000px]:text-base min-[3000px]:px-5 min-[4000px]:px-6
                    `}
                  >
                    <Sparkles className="h-4 w-4 min-[3000px]:h-5 min-[3000px]:w-5" />
                    Features
                  </m.div>

                  <m.h2
                    variants={fadeUp}
                    className={`
                      mt-6 font-semibold tracking-tight text-[#27124f] break-words
                      text-[36px] md:text-[52px] leading-[1.15]
                      min-[2000px]:text-[60px] min-[3000px]:text-[68px]
                      bg-[linear-gradient(110deg,#27124f_0%,#5f53d5_50%,#27124f_100%)]
                      bg-clip-text text-transparent
                    `}
                    style={{ backgroundSize: "200% 100%" }}
                    whileInView={
                      prefersReduced
                        ? undefined
                        : { backgroundPositionX: ["0%", "100%"] }
                    }
                    transition={
                      prefersReduced ? undefined : { duration: 1.4, ease: EASE }
                    }
                  >
                    Smart Video Processing
                  </m.h2>

                  <m.p
                    variants={fadeUp}
                    className={`
                      mt-4 max-w-xl text-base leading-relaxed text-[#3e3a5c]/80 md:text-lg
                      min-[3000px]:text-[20px] min-[4000px]:text-[22px]
                    `}
                  >
                    Upload videos or select from existing content. Our AI
                    analyzes and optimizes for maximum engagement.
                  </m.p>

                  <m.div
                    variants={staggerContainer}
                    className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 min-[3000px]:gap-5"
                  >
                    <m.div variants={slideLeft}>
                      <Feature
                        icon={<Type className="h-5 w-5 text-[#7C7EF4]" />}
                        title="Automated Captions"
                        desc="AI instantly writes punchlines for your memes."
                        border="r"
                      />
                    </m.div>

                    <m.div variants={slideRight}>
                      <Feature
                        icon={<Share2 className="h-5 w-5 text-[#6E6FF2]" />}
                        title="Smart Sharing"
                        desc="Post memes directly to TikTok, Instagram, X, or Facebook."
                      />
                    </m.div>

                    <m.div variants={slideLeft}>
                      <Feature
                        icon={<Flame className="h-5 w-5 text-[#ff6b6b]" />}
                        title="Viral Triggers"
                        desc="Auto-generate memes when trends or keywords start buzzing."
                        border="t"
                      />
                    </m.div>

                    <m.div variants={slideRight}>
                      <Feature
                        icon={<Link2 className="h-5 w-5 text-[#7C7EF4]" />}
                        title="Integration Autos"
                        desc="Connect with popular social media platforms."
                        border="t"
                      />
                    </m.div>
                  </m.div>
                </div>

                {/* Right column */}
                <div className="relative flex flex-col items-start">
                  <m.div
                    variants={slideDown}
                    className="mb-4 w-full max-w-[426px] min-[2000px]:max-w-[520px] min-[3000px]:max-w-[560px]"
                  >
                    <div className="mb-4 w-full md:w-[562px] min-[2000px]:w-[640px] min-[3000px]:w-[720px] min-[4000px]:w-[780px]">
                      <div
                        className={`
                          relative w-full h-[66.76px] min-[2000px]:h-[72px] min-[3000px]:h-[78px]
                          rounded-[64px] border border-[#1F691B29]
                          bg-gradient-to-b from-white/20 to-white/10
                          shadow-[0_4px_40px_rgba(0,0,0,0.04)]
                          px-6 pr-[92px] flex items-center
                        `}
                      >
                        <span
                          className={`
                            inline-flex items-center gap-2 leading-none text-[#27124f]
                            text-[18px] min-[2000px]:text-[20px] min-[3000px]:text-[22px]
                          `}
                        >
                          <img
                            src="/star.svg"
                            alt=""
                            className="h-5 w-5 min-[3000px]:h-6 min-[3000px]:w-6"
                            draggable={false}
                            loading="eager"
                            decoding="async"
                          />
                          AI is Analyzing the video
                        </span>

                        <div
                          className={`
                            pointer-events-none absolute right-2 top-1/2 -translate-y-1/2
                            h-[54px] w-[54px] rounded-full opacity-90
                            bg-[radial-gradient(75%_75%_at_30%_20%,#FFB5D1_0%,#9AA4FF_45%,#7C7EF4_65%,transparent_100%)]
                          `}
                        />
                      </div>
                    </div>
                  </m.div>

                  <m.div
                    variants={zoomIn}
                    whileHover={
                      prefersReduced ? undefined : { y: -3, scale: 1.005 }
                    }
                    transition={{ type: "tween", duration: 0.18 }}
                    className={`
                      w-full md:w-[562px] min-[2000px]:w-[640px] min-[3000px]:w-[720px] min-[4000px]:w-[780px]
                      rounded-[24px] border border-[#E5E4F6]
                      bg-white/80 p-6 md:p-8 min-[3000px]:p-10
                      shadow-[0_10px_36px_rgba(37,18,102,0.10)]
                    `}
                  >
                    <m.h3
                      variants={fadeUp}
                      className={`
                        text-[26px] md:text-[30px]
                        min-[2000px]:text-[34px] min-[3000px]:text-[38px]
                        font-semibold text-[#231942] leading-tight
                      `}
                    >
                      Upload Video
                    </m.h3>

                    <m.div
                      variants={fadeUp}
                      className="my-4 h-px bg-gradient-to-r from-transparent via-[#E9E7F7] to-transparent"
                    />

                    <m.p
                      variants={fadeUp}
                      className="text-sm text-[#4b4668]/80 min-[3000px]:text-base"
                    >
                      Add your video for creating meme
                    </m.p>

                    <m.div
                      variants={fadeUp}
                      className={`
                        mt-5 rounded-2xl border-2 border-dashed border-[#B8B4EE]
                        bg-white/70 p-8 min-[3000px]:p-10
                      `}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      role="button"
                      tabIndex={0}
                      onClick={handleOpenPicker}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenPicker();
                        }
                      }}
                    >
                      {!previewUrl ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10">
                          <m.div
                            whileHover={
                              prefersReduced ? undefined : { scale: 1.03 }
                            }
                            className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-[#F7E9FF] to-[#E8E4FF] shadow-inner min-[3000px]:h-16 min-[3000px]:w-16"
                          >
                            <UploadCloud className="h-7 w-7 text-[#6E6FF2] min-[3000px]:h-8 min-[3000px]:w-8" />
                          </m.div>

                          <p className="text-sm text-[#4b4668] min-[3000px]:text-base">
                            Drop your videos here, or{" "}
                            <span
                              className="text-[#6E6FF2] underline underline-offset-2 cursor-pointer"
                              onClick={(e) => { e.stopPropagation(); handleOpenPicker(); }}
                              role="link"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOpenPicker(); }}
                              aria-label="Click to browse video files"
                            >
                              click to browse
                            </span>
                          </p>
                          {fileError && (
                            <p className="text-xs text-red-600 mt-1">{fileError}</p>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative w-full max-w-full overflow-hidden rounded-xl">
                            <div className="aspect-video bg-black/80">
                              <video
                                src={previewUrl || undefined}
                                className="h-full w-full object-contain"
                                muted
                                loop
                                autoPlay
                                playsInline
                                controls
                              />
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs text-[#4b4668]">
                            <span className="truncate max-w-[70%]">{selectedFile?.name}</span>
                            <button
                              type="button"
                              className="text-[#6E6FF2] underline underline-offset-2"
                              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                              aria-label="Replace video"
                            >
                              Replace
                            </button>
                          </div>
                        </div>
                      )}
                      <input
                        ref={inputRef}
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </m.div>

                    <m.div
                      variants={fadeUp}
                      className="mt-4 flex items-center justify-between text-xs text-[#6b678a] min-[3000px]:text-sm"
                    >
                      <span>Supported files: mp4, mov, mkv</span>
                      <span>
                        Maximum Size: <b>20MB</b>
                      </span>
                    </m.div>

                    <m.button
                      variants={fadeUp}
                      whileHover={
                        prefersReduced ? undefined : { scale: 1.01 }
                      }
                      whileTap={prefersReduced ? undefined : { scale: 0.985 }}
                      className={`
                        mt-6 inline-flex w-full items-center justify-center
                        h-[56px] min-[3000px]:h-[60px]
                        rounded-2xl border border-[#5a4bcb]/40
                        bg-gradient-to-b from-[#7C7EF4] to-[#6F80F0]
                        text-[16px] min-[3000px]:text-[18px] font-medium text-white
                        shadow-[0_8px_24px_rgba(91,12,213,0.20),inset_0_8px_10px_rgba(255,255,255,0.22)]
                        transition-transform
                        disabled:opacity-60 disabled:cursor-not-allowed
                      `}
                      onClick={() => setProcessorOpen(true)}
                      type="button"
                      aria-label="Open video processor"
                      disabled={!selectedFile}
                    >
                      Continue
                    </m.button>
                  </m.div>
                </div>
              </div>
            </div>
          </m.div>
        </section>
        <VideoProcessorModal
          open={processorOpen}
          profile={null}
          onOpenChange={setProcessorOpen}
          onVideoGenerated={() => {}}
          initialFile={selectedFile || undefined}
          initialAnalysis={(() => {
            try {
              if (typeof window === "undefined") return undefined;
              const flag = sessionStorage.getItem("resumeVideoProcessor");
              const state: any = (window as any).__videoProcessorResume;
              if (flag && state && state.videoSummary && Array.isArray(state.memeOptions)) {
                return {
                  videoSummary: state.videoSummary,
                  memeOptions: state.memeOptions,
                  selectedMemeOption: state.selectedMemeOption,
                };
              }
            } catch {}
            return undefined;
          })()}
        />
      </LazyMotion>

    </MotionConfig>
  );
}

/* ---------- helpers ---------- */
const Feature = memo(function Feature({
  icon,
  title,
  desc,
  border,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  border?: "r" | "t";
}) {
  return (
    <div
      className={[
        "grid grid-cols-[28px_1fr] items-start gap-3 pr-6",
        border === "r"
          ? "md:border-r md:pr-8 md:mr-8 border-[#E9E7F7]"
          : "",
        border === "t" ? "pt-6 md:border-t border-[#E9E7F7]" : "",
        "min-[3000px]:gap-4 min-[3000px]:pr-10",
      ].join(" ")}
    >
      {icon && (
        <div className="mt-1 grid h-7 w-7 place-items-center min-[3000px]:h-8 min-[3000px]:w-8">
          {icon}
        </div>
      )}
      <div>
        <h4 className="text-[18px] font-semibold text-[#2a1a59] min-[3000px]:text-[20px]">
          {title}
        </h4>
        <p className="mt-1 text-sm leading-relaxed text-[#4b4668]/80 min-[3000px]:text-base">
          {desc}
        </p>
      </div>
    </div>
  );
});
