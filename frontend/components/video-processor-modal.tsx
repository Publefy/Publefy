"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { X, Zap, Calendar, Maximize2, Play, Check, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

import type { Profile } from "@/types/profile";
import type { AnalyzeResult } from "@/types/analyze-result";
import type { FinalizeResult } from "@/types/finalize-result";
import type { AxiosProgressEvent } from "axios";

import { apiServiceDefault } from "@/services/api/api-service";
import { API_BASE, axiosConfig, CLOUD_RUN_BASE, MEDIA_BASE, VIDEO_ANALYZE_URL } from "@/services/api/apiConfig";
import { getAuthToken } from "@/utils/getAuthToken";

/* -------------------- URL/auth helpers (robust) -------------------- */
function getOrigin(u: string) {
  try { return new URL(u).origin; } catch { return ""; }
}
function normalizeApiUrl(u?: string): string | undefined {
  if (!u) return u;
  const cleaned = rewritePublefyHost(u);
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  const base =
    axiosConfig.baseURL?.replace(/\/+$/, "") ||
    API_BASE.replace(/\/+$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const path = cleaned.replace(/^\/+/, "");
  if (!base) return `/${path}`;
  return `${base}/${path}`;
}

function shouldAttachAuth(u: string) {
  const targetOrigin =
    getOrigin(u) ||
    (typeof window !== "undefined" && !/^https?:\/\//i.test(u) ? window.location.origin : "");
  if (!targetOrigin) return false;
  const origins = new Set(
    [
      axiosConfig.baseURL,
      API_BASE,
      MEDIA_BASE,
      typeof window !== "undefined" ? window.location.origin : undefined,
    ]
      .filter((value): value is string => value !== undefined)
      .map((value) => getOrigin(value))
      .filter((value): value is string => !!value)
  );
  return origins.has(targetOrigin);
}


function rewritePublefyHost(url: string): string {
  if (!url) return url;
  try {
    const trimmed = url.replace(/\/+$/, "");
    if (/^https?:\/\/publefy\.com/i.test(trimmed)) {
      const path = trimmed.replace(/^https?:\/\/publefy\.com\/?/i, "");
      const base = (MEDIA_BASE || API_BASE || CLOUD_RUN_BASE).replace(/\/+$/, "");
      if (!base) return url;
      return `${base}/${path.replace(/^\/+/, "")}`;
    }
  } catch { }
  return url;
}
async function fetchAsObjectURL(url: string) {
  const target = normalizeApiUrl(url) || url;
  const headers: Record<string, string> = {};
  const init: RequestInit = { cache: "no-store" };

  if (shouldAttachAuth(target)) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    init.credentials = "include";
  }

  const res = await fetch(target, { ...init, headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
async function fetchProtectedBlob(url: string) {
  const target = normalizeApiUrl(url) || url;
  const headers: Record<string, string> = {};
  const init: RequestInit = {};

  if (shouldAttachAuth(target)) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    init.credentials = "include";
  }

  const res = await fetch(target, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.blob();
}

// unwrap Axios-like responses safely
function unwrap<T>(res: any): T {
  return (res?.data ?? res) as T;
}

/* ---------- Thumb component (image-aware, with CORS fallback & autoplay) ---------- */
function isLikelyImage(url?: string) {
  return !!url && /\.(jpe?g|png|webp|gif)(\?|#|$)/i.test(url);
}

function AuthMediaThumb({
  full,
  thumb,
  thumbIsVideo,
  className,
  onClick,
  title,
  onLoadingStateChange,
}: {
  full?: string;
  thumb?: string;
  thumbIsVideo?: boolean;
  className?: string;
  onClick?: () => void;
  title?: string;
  onLoadingStateChange?: (isLoading: boolean) => void;
}) {
  const primary = thumbIsVideo ? full : (thumb || full);
  const fallback = !thumbIsVideo && thumb && full && thumb !== full ? full : null;
  const src = primary;
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [forceVideo, setForceVideo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Use ref to store the callback to avoid dependency issues
  const onLoadingStateChangeRef = useRef(onLoadingStateChange);
  useEffect(() => {
    onLoadingStateChangeRef.current = onLoadingStateChange;
  }, [onLoadingStateChange]);

  useEffect(() => {
    if (!src) {
      setBlobUrl(null);
      setDirectUrl(null);
      setForceVideo(false);
      setIsLoading(false);
      onLoadingStateChangeRef.current?.(false);
      return;
    }
    setForceVideo(false);
    setIsLoading(true);
    onLoadingStateChangeRef.current?.(true);
    let cancelled = false;
    let revoke: string | null = null;
    const resolveSource = async (source: string | null, allowFallback: boolean) => {
      if (!source) {
        setBlobUrl(null);
        setDirectUrl(null);
        setIsLoading(false);
        onLoadingStateChangeRef.current?.(false);
        return;
      }
      const normalized = normalizeApiUrl(source) || source;
      try {
        const obj = await fetchAsObjectURL(normalized);
        if (cancelled) return;
        revoke = obj;
        setBlobUrl(obj);
        setDirectUrl(null);
        setForceVideo(thumbIsVideo === true ? true : false);
        // Loading state will be updated when image loads via onLoad handler
      } catch (e) {
        if (cancelled) return;
        if (allowFallback && fallback && fallback !== source) {
          resolveSource(fallback, false);
          return;
        }
        setBlobUrl(null);
        setDirectUrl(normalized);
        setForceVideo(thumbIsVideo === true || !isLikelyImage(normalized));
        console.warn("[AuthMediaThumb] blob fetch failed, using direct URL:", normalized, e);
        // Loading state will be updated when image loads via onLoad handler
      }
    };

    resolveSource(src, true);
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src, fallback]);

  const handleMediaError = () => {
    const fallbackSource = fallback || full || thumb || null;
    if (!fallbackSource) {
      setIsLoading(false);
      onLoadingStateChangeRef.current?.(false);
      return;
    }
    const normalized = normalizeApiUrl(fallbackSource) || fallbackSource;
    setBlobUrl(null);
    setDirectUrl(normalized);
    setForceVideo(thumbIsVideo === true || !isLikelyImage(normalized));
    // Keep loading state true if we're trying a fallback
  };

  const handleMediaLoad = () => {
    setIsLoading(false);
    onLoadingStateChangeRef.current?.(false);
  };


  if (!src) {
    return <div className={`bg-gray-100 ${className}`} title="No media available" />;
  }

  const url = blobUrl ?? directUrl ?? undefined;
  const treatAsImage = !forceVideo && (
    thumbIsVideo === false
      ? true
      : thumbIsVideo === true
        ? false
        : isLikelyImage(url || primary || thumb)
  );
  const poster =
    !treatAsImage && !thumbIsVideo && thumb && isLikelyImage(thumb)
      ? normalizeApiUrl(thumb) || thumb
      : undefined;

  if (treatAsImage) {
    return (
      <img
        className={className}
        src={url}
        onClick={onClick}
        title={title}
        alt={title || "thumbnail"}
        onLoad={handleMediaLoad}
        onError={handleMediaError}
        crossOrigin="anonymous"
        style={{
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.2s ease-in-out',
        }}
      />
    );
  }

  return (
    <video
      className={className}
      src={url}
      muted
      loop
      autoPlay
      playsInline
      preload="metadata"
      poster={poster}
      onClick={onClick}
      title={title}
      onLoadedData={handleMediaLoad}
      onError={handleMediaError}
      crossOrigin="anonymous"
      style={{
        opacity: isLoading ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
      }}
    />
  );
}

/* -------------------- Types -------------------- */
type UploadReelResp = {
  msg: string;
  reelDbId?: string | null;
  reelId: string;
  profile: { id: string; ig_id?: string };
  source: { blob: string };
  destination: {
    blob: string;
    apiUrl: string;
  };
};

type MemeBankItem = {
  id: string;
  filename?: string;
  text?: string;
  assets: { full?: string; thumb?: string };
  thumbIsVideo?: boolean;

  _generated?: true;
  _reelId?: string;
  _appliedPrompt?: string;
};

type Video = {
  id: string;
  reel_id?: string;
  caption?: string;
  media_type?: string;
  media_url: string;
  thumbnail_url?: string;
  timestamp?: string;
  uploaded_by?: string;
  filename?: string;
  like_count?: number;
  comments_count?: number;
  permalink?: string;
};

type GeneratedMemeResp = {
  industry: string;
  niche?: string | null;
  keyword?: string | null;
  countRequested: number;
  countReturned: number;
  allowRepeats: boolean;
  onePromptForAll: boolean;
  promptSource: "gemini" | "fallback" | "none";
  geminiError?: string | null;
  promptCandidates: string[];
  appliedPrompts: string[];
  items: Array<{
    reelId: string;
    sourceBlob: string;
    generatedBlob: string;
    apiUrl: string;
    thumb?: string;
    thumbIsVideo?: boolean;
    appliedPrompt: string;
    fingerprint: string;
    watermarkApplied: boolean;
    scheduleReady: boolean;
  }>;
};

/* Normalize meme items so media URLs are absolute and consistent */
function normalizeMemeBankItem(item: MemeBankItem): MemeBankItem {
  const full = item.assets?.full ? normalizeApiUrl(item.assets.full) || item.assets.full : undefined;
  const thumb = item.assets?.thumb ? normalizeApiUrl(item.assets.thumb) || item.assets.thumb : undefined;
  const thumbIsVideo =
    item.thumbIsVideo ??
    ((!!thumb && /\.(mp4|mov|m4v|webm|avi)(\?|#|$)/i.test(thumb)) ||
      (!!full && /\.(mp4|mov|m4v|webm|avi)(\?|#|$)/i.test(full)));
  return {
    ...item,
    assets: { ...item.assets, full, thumb },
    thumbIsVideo,
  };
}

/* -------------------- Component -------------------- */
const LOGIN_DEST = "/?auth=login";

export function VideoProcessorModal({
  open,
  profile,
  onOpenChange,
  onVideoGenerated,
  initialFile,
  initialAnalysis,
}: {
  open: boolean;
  profile: Profile | null;
  onOpenChange: (open: boolean) => void;
  onVideoGenerated: (videoUrl: string) => void;
  initialFile?: File;
  initialAnalysis?: { videoSummary: string; memeOptions: string[]; selectedMemeOption?: string };
}) {
  // Upload / existing


  // Upload / existing
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("Upload your video");
  const [fileSize, setFileSize] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [existingVideos, setExistingVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analyze / finalize
  const [industry, setIndustry] = useState("Fitness");
  const [selectedMemeOption, setSelectedMemeOption] = useState<string | null>(null);
  const [videoSummary, setVideoSummary] = useState("");
  const [memeOptions, setMemeOptions] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [generateProgress, setGenerateProgress] = useState(0);

  // Meme Bank
  const [memeNiche, setMemeNiche] = useState("");
  const [generatedMemes, setGeneratedMemes] = useState<MemeBankItem[]>([]);
  const [selectedMemes, setSelectedMemes] = useState<Set<string>>(new Set());
  const [isGeneratingMemes, setIsGeneratingMemes] = useState(false);
  const [memeLoadingStates, setMemeLoadingStates] = useState<Map<string, boolean>>(new Map());
  const [fakeProgress, setFakeProgress] = useState(0);
  const [averageGenerationMs, setAverageGenerationMs] = useState<number>(120_000);
  const generationCountRef = useRef(0);
  const generationStartRef = useRef<number | null>(null);
  const fakeProgressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const MIN_FAKE_DURATION_MS = 120_000;
  const MAX_FAKE_DURATION_MS = 180_000; // cap the fake bar to 3 minutes

  // Debug: Log when generatedMemes changes
  useEffect(() => {
    console.log("[generate-memes] generatedMemes state updated:", generatedMemes.length, generatedMemes);
  }, [generatedMemes]);
  const [regeneratingMemeId, setRegeneratingMemeId] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Niche suggestions
  const nicheSuggestions = ["Fitness", "Real Estate", "Gym", "Food", "Marketing", "Travel", "Finance", "Pets"];
  const [resumeMeta, setResumeMeta] = useState<{ sourceType?: string; fileName?: string; selectedVideoId?: string; selectedMemes?: string[] } | null>(null);

  // Preview modal for Meme Bank items
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  // toggles
  const [allowRepeats, setAllowRepeats] = useState(true);
  const [onePromptForAll, setOnePromptForAll] = useState(false);

  const resultsRef = useRef<HTMLDivElement | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const emitVideosUpdated = useCallback((igId?: string | number) => {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("videos:updated", { detail: { igId: igId ? String(igId) : undefined } })
        );
      }
    } catch { }
  }, []);

  // Refresh library when modal closes to sync any background auto-saves
  // Then clear state to break the re-render loop
  useEffect(() => {
    if (!open && generatedMemes.length > 0) {
      emitVideosUpdated(profile?.ig_id || profile?.id);

      // Cleanup: Clear generated state so this only runs ONCE per close
      // and resets the generation tab for the next use.
      setGeneratedMemes([]);
      setSelectedMemes(new Set());
      setMemeNiche("");
    }
  }, [open, generatedMemes.length, profile, emitVideosUpdated]);

  const requireAuth = (actionLabel: string) => {
    const tok = getAuthToken();
    if (!tok) {
      try {
        if (typeof window !== "undefined") {
          const resumeState: any = {
            sourceType: selectedMemes.size === 1 ? "meme" : "none",
            industry,
            videoSummary,
            memeOptions,
            selectedMemeOption,
            selectedMemes: Array.from(selectedMemes),
          };
          (window as any).__videoProcessorResume = resumeState;
          sessionStorage.setItem("resumeVideoProcessor", "1");
          try {
            sessionStorage.setItem(
              "resumeVideoProcessorState",
              JSON.stringify({
                ...resumeState,
                // Files are not serializable; ensure not included in storage
                file: undefined,
              })
            );
          } catch { }
        }
      } catch { }
      toast({
        title: "Sign in required",
        description: `Please log in to ${actionLabel}.`,
        variant: "destructive",
      });
      onOpenChange(false);
      router.push(LOGIN_DEST);
      return false;
    }
    return true;
  };

  const getSingleSelectedMeme = () => {
    if (selectedMemes.size !== 1) return null;
    const id = Array.from(selectedMemes)[0];
    return generatedMemes.find((m) => m.id === id) || null;
  };

  /* ---------- EXISTING tab: fetch user's uploaded reels ---------- */
  // Removed - only Meme Bank is available now
  // useEffect(() => {
  //   if (!(open && tab === "existing")) return;
  //   if (!requireAuth("view your uploaded videos")) return;
  //
  //   setIsLoading(true);
  //   (async () => {
  //     try {
  //       const dataRes = await apiServiceDefault.get<{ reels: any[] }>("/instagram/my-uploaded-reels");
  //       const data = unwrap<{ reels: any[] }>(dataRes);
  //       setExistingVideos(
  //         (data.reels || []).map((v, i) => ({
  //           id: v.id || `existing-${i}`,
  //           reel_id: v.reel_id,
  //           caption: v.caption || "",
  //           media_type: v.media_type || "VIDEO",
  //           media_url: v.download_url ? `${axiosConfig.baseURL}${v.download_url}` : "",
  //           thumbnail_url: v.thumbnail_url || "",
  //           timestamp: v.timestamp || "",
  //           uploaded_by: v.uploaded_by,
  //           filename: v.filename,
  //           like_count: v.like_count || 0,
  //           comments_count: v.comments_count || 0,
  //           permalink: v.permalink || "",
  //         }))
  //       );
  //     } catch {
  //       toast({
  //         title: "Error",
  //         description: "Could not fetch existing videos.",
  //         variant: "destructive",
  //       });
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   })();
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [open, tab]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // no-op

  // Seed analysis data when resuming after auth
  useEffect(() => {
    if (!open) return;
    if (initialAnalysis) {
      const { videoSummary: vs, memeOptions: mo, selectedMemeOption: sm } = initialAnalysis;
      if (vs) setVideoSummary(vs);
      if (Array.isArray(mo)) setMemeOptions(mo);
      if (sm) setSelectedMemeOption(sm);
    }
  }, [open, initialAnalysis]);

  // Read serializable resume state to power UX banner after login
  useEffect(() => {
    if (!open) return;
    try {
      const raw = sessionStorage.getItem("resumeVideoProcessorState");
      if (!raw) return;
      const state = JSON.parse(raw);
      setResumeMeta({
        sourceType: state?.sourceType,
        fileName: state?.fileName,
        selectedVideoId: state?.selectedVideoId,
        selectedMemes: state?.selectedMemes,
      });
    } catch { }
  }, [open]);

  // Seed file from landing section (drag & drop / browse) - disabled, only Meme Bank now
  // useEffect(() => {
  //   if (!open) return;
  //   if (initialFile) {
  //     setTab("upload");
  //     setFile(initialFile);
  //     setFileName(initialFile.name);
  //     setFileSize(`${(initialFile.size / (1024 * 1024)).toFixed(1)} MB`);
  //     setSelectedVideoId(null);
  //     setSelectedMemes(new Set());
  //   }
  // }, [open, initialFile]);

  const handleFilePickerClick = () => {
    // Allow guests to upload a local file for analysis without auth
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (f.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a video smaller than 50 MB.",
          variant: "destructive",
        });
        return;
      }
      setFile(f);
      setFileName(f.name);
      setFileSize(`${(f.size / (1024 * 1024)).toFixed(1)} MB`);
      setSelectedVideoId(null);
      setSelectedMemes(new Set());
    }
  };

  const handleVideoSelect = (id: string) => {
    if (!requireAuth("select an existing video")) return;
    setSelectedVideoId(id);
    setFile(null);
    setFileName("Upload your video");
    setFileSize("");
    setSelectedMemes(new Set());
  };

  const toggleMemeSelection = (id: string) => {
    setSelectedMemes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /* ---------- Analyze (manual) ---------- */
  const handleAnalyze = async () => {
    const singleMeme = getSingleSelectedMeme();

    if (!singleMeme || !industry) {
      toast({
        title: "Error",
        description:
          "Select exactly one Meme Bank item and enter an industry.",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setAnalyzeProgress(0);
    const formData = new FormData();

    try {
      if (singleMeme) {
        const src = singleMeme.assets?.full;
        if (!src) throw new Error("Selected meme has no media.");
        const blob = await fetchProtectedBlob(src);
        const guessedName = (singleMeme.filename || `${singleMeme.id}.mp4`).replace(/\s+/g, "_");
        formData.append("file", new File([blob], guessedName, { type: blob.type || "video/mp4" }));
      }

      formData.append("industry", industry);

      const raw = await apiServiceDefault.post<AnalyzeResult>(VIDEO_ANALYZE_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (pe: AxiosProgressEvent) => {
          if (pe.total) setAnalyzeProgress(Math.round((pe.loaded / pe.total) * 100));
        },
      });

      const analyze = unwrap<AnalyzeResult>(raw);
      const video_summary = analyze?.video_summary ?? "";
      const audio_summary = analyze?.audio_summary ?? "";
      const options = Array.isArray(analyze?.meme_options) ? analyze.meme_options : [];

      setVideoSummary(`**Video:** ${video_summary}\n\n**Audio:** ${audio_summary}`);
      setMemeOptions(options);
      setSelectedMemeOption(null);
      setAnalyzeProgress(100);
      toast({ title: "Success", description: "Video analyzed." });

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);

      setTimeout(() => setAnalyzing(false), 400);
      setTimeout(() => setAnalyzeProgress(0), 800);

      // Keep resume state updated to enable continue-after-login UX
      try {
        if (typeof window !== "undefined") {
          const resumeState: any = (window as any).__videoProcessorResume || {};
          (window as any).__videoProcessorResume = {
            ...resumeState,
            sourceType: singleMeme ? "meme" : (file ? "upload" : "none"),
            selectedMemes: Array.from(selectedMemes),
            industry,
            videoSummary: `**Video:** ${video_summary}\n\n**Audio:** ${audio_summary}`,
            memeOptions: options,
            selectedMemeOption: null,
          };
          sessionStorage.setItem("resumeVideoProcessor", "1");
        }
      } catch { }
    } catch (err: any) {
      setAnalyzeProgress(100);
      setTimeout(() => setAnalyzing(false), 600);
      setTimeout(() => setAnalyzeProgress(0), 1000);
      toast({ title: "Analyze failed", description: err?.message || "Error", variant: "destructive" });
    }
  };

  /* ---------- Finalize (manual) ---------- */
  const handleFinalize = async () => {
    if (!requireAuth("generate a post")) return;
    const singleMeme = getSingleSelectedMeme();

    if (!selectedMemeOption || !(videoSummary.length > 0 && memeOptions.length > 0)) {
      toast({
        title: "Analyze first",
        description: "Run Analyze and pick a meme option to enable Generate Post.",
        variant: "destructive",
      });
      return;
    }
    // profile check removed to allow adding to library without a connected account
    if (!singleMeme) {
      toast({
        title: "No meme selected",
        description: "Select exactly one Meme Bank item.",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setGenerateProgress(0);
    const formData = new FormData();

    try {
      if (singleMeme) {
        const src = singleMeme.assets?.full;
        if (!src) throw new Error("Selected meme has no media.");
        const blob = await fetchProtectedBlob(src);
        const guessedName = (singleMeme.filename || `${singleMeme.id}.mp4`).replace(/\s+/g, "_");
        formData.append("file", new File([blob], guessedName, { type: blob.type || "video/mp4" }));
      }

      formData.append("caption", selectedMemeOption);
      formData.append("summary", videoSummary);
      if (profile?.id) {
        formData.append("profile_id", profile.id);
      }
      if (profile?.ig_id) {
        formData.append("ig_id", profile.ig_id);
      }

      const raw = await apiServiceDefault.post<FinalizeResult>("video/finalize/", formData, {
        onUploadProgress: (pe: AxiosProgressEvent) => {
          if (pe.total) setGenerateProgress(Math.round((pe.loaded / pe.total) * 100));
        },
      });

      const finalizeResult = unwrap<FinalizeResult>(raw);

      setGenerateProgress(100);
      setTimeout(() => setGenerating(false), 500);
      setTimeout(() => setGenerateProgress(0), 1000);

      const fullUrl = finalizeResult?.final_video_url
        ? finalizeResult.final_video_url
        : (finalizeResult?.download_url
          ? (finalizeResult.download_url.startsWith("http")
            ? finalizeResult.download_url
            : `${axiosConfig.baseURL}${finalizeResult.download_url}`)
          : null);

      if (fullUrl) {
        onVideoGenerated(fullUrl);
        emitVideosUpdated(profile?.ig_id || profile?.id);
        onOpenChange(false);
        toast({ title: "Post Generated!", description: "Your post is ready to publish." });
      } else {
        throw new Error("Missing download URL from response.");
      }
    } catch (err: any) {
      setGenerateProgress(100);
      setTimeout(() => setGenerating(false), 600);
      setTimeout(() => setGenerateProgress(0), 1000);
      toast({
        title: "Finalize failed",
        description: err?.response?.data?.error || err.message || "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  const isAnalyzeSuccessful = videoSummary.length > 0 && memeOptions.length > 0;
  const clampedFakeProgress = Math.min(100, Math.max(0, fakeProgress));

  /* ---------- Meme Bank: Auto-generate rendered memes (server overlays + DB) ---------- */
  const handleAutoGenerateRenderedMemes = async () => {
    if (!requireAuth("auto-generate memes")) return;

    const userInput = memeNiche.trim();
    if (!userInput) {
      toast({
        title: "Keyword / Niche required",
        description: "Enter hashtags or a niche (e.g., #monday #coffee or Fitness).",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingMemes(true);
    startFakeProgress(averageGenerationMs || 45_000);
    setSelectedMemes(new Set());

    const payload = {
      industry: userInput,
      keyword: "",
      niche: "",
      count: 5,
      allowRepeats,
      onePromptForAll,
      profileId: profile?.id || undefined,
    };

    const attempt = async () => {
      // NOTE: use the long-timeout helper here
      return apiServiceDefault.postLong<GeneratedMemeResp>(
        "/memes/from-bank/generate-memes",
        payload,
        { timeout: 180_000 }  // 3 minutes for this call
      );
    };

    let generationSucceeded = false;
    try {
      let raw;
      try {
        raw = await attempt();
      } catch (e: any) {
        // retry once if it was just a timeout
        if (e?.code === "ECONNABORTED") {
          console.warn("[generate-memes] first attempt timed out, retrying once…");
          raw = await attempt();
        } else {
          throw e;
        }
      }

      const data = unwrap<GeneratedMemeResp>(raw);
      console.log("[generate-memes] Response data:", data);

      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        toast({
          title: "No videos returned",
          description: data?.geminiError || "Try different keywords/industry or fewer items.",
          variant: "destructive",
        });
        setGeneratedMemes([]);
        return;
      }

      const normalizedItems: MemeBankItem[] = data.items.map((it) => {
        const inferredThumbIsVideo =
          it.thumbIsVideo ??
          /\.(mp4|mov|m4v|webm|avi)(\?|#|$)/i.test(it.thumb || it.apiUrl || it.generatedBlob || "");
        const normalized = normalizeMemeBankItem({
          id: it.generatedBlob || it.reelId || `meme-${Math.random()}`,
          filename: it.reelId,
          text: it.appliedPrompt,
          assets: {
            full: normalizeApiUrl(it.apiUrl) || it.apiUrl,
            thumb: normalizeApiUrl(it.thumb) || it.thumb,
          },
          thumbIsVideo: inferredThumbIsVideo,
          _generated: true,
          _reelId: it.reelId,
          _appliedPrompt: it.appliedPrompt,
        });
        console.log("[generate-memes] Normalized item:", normalized);
        return normalized;
      });

      console.log("[generate-memes] All normalized items:", normalizedItems);
      console.log("[generate-memes] Items count:", normalizedItems.length);
      console.log("[generate-memes] Appending new generatedMemes:", normalizedItems);
      setGeneratedMemes((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const dedupedNew = normalizedItems.map((item) => {
          let nextId = item.id;
          if (existingIds.has(nextId)) {
            let suffix = 1;
            while (existingIds.has(`${nextId}-${suffix}`)) suffix += 1;
            nextId = `${nextId}-${suffix}`;
          }
          existingIds.add(nextId);
          return { ...item, id: nextId };
        });
        const combined = [...prev, ...dedupedNew];
        console.log("[generate-memes] Combined meme count:", combined.length);
        return combined;
      });
      generationSucceeded = true;
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

      const src =
        data.promptSource === "gemini" ? "Gemini" :
          data.promptSource === "fallback" ? "fallback list" : "none";
      toast({
        title: "Memes generated",
        description: `Created ${data.countReturned ?? normalizedItems.length} rendered memes (${src}).`,
      });
    } catch (err: any) {
      const isTimeout = err?.code === "ECONNABORTED";
      console.error("[generate-memes] error:", err);
      toast({
        title: isTimeout ? "Still processing…" : "Error",
        description: isTimeout
          ? "The server is still rendering videos. Increase timeout or switch to a job + polling flow."
          : (err?.response?.data?.error || err?.message || "Could not auto-generate memes."),
        variant: "destructive",
      });
    } finally {
      const duration = generationStartRef.current ? Date.now() - generationStartRef.current : null;
      const finish = () => {
        const baselineAvg = Math.min(
          Math.max(averageGenerationMs || MIN_FAKE_DURATION_MS, MIN_FAKE_DURATION_MS),
          MAX_FAKE_DURATION_MS
        );
        setFakeProgress(100);
        if (generationSucceeded && duration !== null) {
          const count = generationCountRef.current;
          const newAvg = Math.round(((averageGenerationMs || baselineAvg) * count + duration) / (count + 1));
          generationCountRef.current = count + 1;
          setAverageGenerationMs(newAvg);
        }
        stopFakeProgress();
        setIsGeneratingMemes(false);
      };

      if (duration !== null && !generationSucceeded) {
        const targetDuration = Math.min(
          Math.max(averageGenerationMs || MIN_FAKE_DURATION_MS, MIN_FAKE_DURATION_MS),
          MAX_FAKE_DURATION_MS
        );
        const remaining = Math.max(0, targetDuration - duration);
        if (remaining > 0) {
          setTimeout(finish, remaining);
        } else {
          finish();
        }
      } else {
        finish();
      }
    }
  };

  /* ---------- Meme Bank: Regenerate one (templates only – kept for parity) ---------- */
  const handleRegenerateMeme = async (memeId: string) => {
    if (!requireAuth("regenerate memes")) return;
    const item = generatedMemes.find(m => m.id === memeId);

    const keyword = memeNiche.trim();
    if (!keyword) return;

    setRegeneratingMemeId(memeId);
    try {
      const raw = await apiServiceDefault.post<{ item: MemeBankItem | null; message?: string }>(
        "/memes/from-bank/regen-at",
        {
          keyword,
          niche: keyword,
          replaceId: memeId,
          existingIds: generatedMemes.map((m) => m.id),
          allowRepeats,
          profileId: profile?.id || undefined,
        }
      );

      const data = unwrap<{ item: MemeBankItem | null; message?: string }>(raw);

      if (!data.item) {
        toast({
          title: "Nothing new",
          description: data.message || "No alternative video found.",
        });
        return;
      }

      setGeneratedMemes((prev) =>
        prev.map((m) => (m.id === memeId ? normalizeMemeBankItem(data.item!) : m))
      );
      toast({ title: "Regenerated", description: "Swapped with another matching video." });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.response?.data?.error || err.message || "Failed to regenerate meme.",
        variant: "destructive",
      });
    } finally {
      setRegeneratingMemeId(null);
    }
  };

  /* ---------- Meme Bank: Schedule Selected ---------- */
  function idToBlob(id: string) {
    if (!id) return id;
    if (id.startsWith("/memes/media/")) {
      const encoded = id.replace(/^\/memes\/media\//, "");
      return decodeURIComponent(encoded);
    }
    return id;
  }

  const stopFakeProgress = () => {
    if (fakeProgressTimer.current) {
      clearInterval(fakeProgressTimer.current);
      fakeProgressTimer.current = null;
    }
    generationStartRef.current = null;
  };

  const startFakeProgress = (targetMs: number) => {
    stopFakeProgress();
    const start = Date.now();
    generationStartRef.current = start;
    setFakeProgress(0);
    const targetDuration = Math.min(
      Math.max(targetMs, MIN_FAKE_DURATION_MS),
      MAX_FAKE_DURATION_MS
    );
    fakeProgressTimer.current = setInterval(() => {
      if (!generationStartRef.current) return;
      const elapsed = Date.now() - generationStartRef.current;
      const ratio = targetDuration > 0 ? Math.min(elapsed / targetDuration, 0.98) : 0;
      const next = Math.min(98, Math.floor(ratio * 98));
      setFakeProgress((prev) => (next > prev ? next : prev));
    }, 350);
  };

  useEffect(() => {
    return () => stopFakeProgress();
  }, []);

  const handleScheduleNow = async () => {
    if (!requireAuth("generate posts from memes")) return;

    if (selectedMemes.size === 0) {
      toast({
        title: "No memes selected",
        description: "Please select at least one.",
        variant: "destructive",
      });
      return;
    }

    setScheduling(true);
    try {
      const tok = getAuthToken();

      const tasks = Array.from(selectedMemes).map(async (selId) => {
        const meme = generatedMemes.find((m) => m.id === selId);
        if (!meme) {
          return { id: selId, ok: false as const, reason: "Item not found." };
        }

        if (meme._generated) {
          try {
            // Explicitly move from 'draft' to 'completed' status
            // Use the correct internal endpoint for existing drafts
            await apiServiceDefault.post("/video/save-meme", {
              reel_id: meme._reelId,
              ig_id: profile?.ig_id || undefined,
              profile_id: profile?.id || undefined
            });
            return {
              id: selId,
              ok: true as const,
              url: meme.assets?.full || "",
            };
          } catch (err: any) {
            const reason = err?.response?.data?.error || err?.message || "Failed to save to library.";
            return { id: selId, ok: false as const, reason };
          }
        }

        if (!meme.assets?.full) {
          return { id: selId, ok: false as const, reason: "Missing meme media URL." };
        }

        try {
          const blob = await fetchProtectedBlob(meme.assets.full);
          const fname =
            (meme.filename || `${meme.id}.mp4`).replace(/\s+/g, "_") || "meme.mp4";

          const baseName = (meme.filename || "meme")
            .replace(/\.[a-z0-9]+$/i, "")
            .replace(/[^a-z0-9]+/gi, "");
          const caption =
            (meme.text && meme.text.trim()) ||
            (selectedMemeOption ?? "") ||
            `#${baseName || "meme"}`;
          const summary = (videoSummary && videoSummary.trim()) || caption;

          const fd = new FormData();
          fd.append("file", new File([blob], fname, { type: blob.type || "video/mp4" }));
          fd.append("caption", caption);
          fd.append("summary", summary);
          if (profile?.id) {
            fd.append("profile_id", profile.id);
          }
          if (profile?.ig_id) {
            fd.append("ig_id", profile.ig_id);
          }

          const raw = await apiServiceDefault.post<FinalizeResult>("video/finalize/", fd);

          const finalize = unwrap<FinalizeResult>(raw);
          const fullUrl = finalize?.download_url
            ? (finalize.download_url.startsWith("http")
              ? finalize.download_url
              : `${axiosConfig.baseURL}${finalize.download_url}`)
            : null;

          if (!fullUrl) throw new Error("Missing download URL from response.");

          return { id: selId, ok: true as const, url: fullUrl };
        } catch (err: any) {
          const reason = err?.response?.data?.error || err?.message || "Failed to finalize.";
          return { id: selId, ok: false as const, reason };
        }
      });

      const results = await Promise.all(tasks);
      const ok = results.filter((r) => r.ok) as Array<{ id: string; ok: true; url: string }>;
      const bad = results.filter((r) => !r.ok) as Array<{ id: string; ok: false; reason: string }>;

      if (ok.length > 0) {
        toast({
          title: "Posts generated 🎉",
          description: `Created ${ok.length} post${ok.length === 1 ? "" : "s"} from your selection.`,
          className: "bg-green-100 text-green-800",
        });
      }
      if (bad.length > 0) {
        toast({
          title: "Some failed",
          description: bad.length === 1 ? bad[0].reason : `${bad.length} items failed (see console).`,
          variant: "destructive",
        });
        console.warn("[meme-bank finalize failed]", bad);
      }

      if (ok.length > 0) {
        emitVideosUpdated(profile?.ig_id || profile?.id);
        setSelectedMemes(new Set());
        onOpenChange(false);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Could not generate posts.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  /* ---------- Preview modal helpers ---------- */
  const openPreviewFor = async (title: string, src?: string) => {
    if (!src) return;
    try {
      const obj = await fetchAsObjectURL(src);
      setPreviewBlobUrl(obj);
      setPreviewTitle(title);
      setPreviewOpen(true);
    } catch {
      // Fall back to direct URL in the preview too
      const direct = normalizeApiUrl(src) || src;
      setPreviewBlobUrl(direct);
      setPreviewTitle(title);
      setPreviewOpen(true);
    }
  };

  const closePreview = () => {
    try {
      previewVideoRef.current?.pause();
    } catch { }
    if (previewBlobUrl && previewBlobUrl.startsWith("blob:")) URL.revokeObjectURL(previewBlobUrl);
    setPreviewBlobUrl(null);
    setPreviewOpen(false);
    setPreviewTitle("");
  };

  useEffect(() => {
    if (!previewOpen && previewBlobUrl) {
      try {
        previewVideoRef.current?.pause();
      } catch { }
      if (previewBlobUrl.startsWith("blob:")) URL.revokeObjectURL(previewBlobUrl);
      setPreviewBlobUrl(null);
    }
  }, [previewOpen, previewBlobUrl]);

  useEffect(() => {
    if (!open && previewOpen) closePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const singleMemeSelected = selectedMemes.size === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* keep max height, but allow inner content to scroll */}
      <DialogContent className="w-[95vw] max-w-[1400px] p-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold text-[#301B69]">Meme Bank</DialogTitle>
          <DialogDescription className="text-[#5A5192]">
            Generate 5 memes from our bank.
          </DialogDescription>
        </DialogHeader>

        {/* Removed resume banner per UX request */}

        {/* body - scrollable area */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0 flex flex-col meme-bank-scroll">
          <style>{`
            .meme-bank-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .meme-bank-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .meme-bank-scroll::-webkit-scrollbar-thumb {
              background: rgba(124, 126, 244, 0.3);
              border-radius: 3px;
            }
            .meme-bank-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(124, 126, 244, 0.5);
            }
            .meme-bank-scroll {
              scrollbar-width: thin;
              scrollbar-color: rgba(124, 126, 244, 0.3) transparent;
            }
            @media (min-width: 1280px) {
              .meme-results-grid {
                grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
              }
            }
            @media (max-width: 1279px) {
              .meme-results-grid {
                grid-template-columns: repeat(5, 200px) !important;
              }
            }
            @keyframes pulse-soft {
              0%, 100% {
                opacity: 0.5;
              }
              50% {
                opacity: 1;
              }
            }
            .animate-pulse-soft {
              animation: pulse-soft 2s ease-in-out infinite;
            }
            /* Hide broken image icons */
            .meme-results-grid img {
              color: transparent;
              font-size: 0;
            }
            /* Ensure broken image icons are covered by background */
            .meme-results-grid .relative img {
              position: relative;
              z-index: 0;
            }
          `}</style>
          {/* MEME BANK */}
          <div className="flex-1 flex flex-col">
            <div className="space-y-4">
              <div ref={resultsRef} />
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <div className="flex-1">
                  <Label htmlFor="meme-niche" className="text-sm font-medium text-[#301B69]">
                    Niche / Topic
                  </Label>
                  <Input
                    id="meme-niche"
                    placeholder="e.g., fitness, real estate, gym"
                    value={memeNiche}
                    onChange={(e) => setMemeNiche(e.target.value)}
                    className={cn(
                      "mt-1 h-10 border-[#E7E5F7] focus:border-[#7C7EF4] focus:ring-[#7C7EF4]/20",
                      prefersReducedMotion ? "" : "transition-all duration-200"
                    )}
                    onKeyDown={(e) => e.key === "Enter" && handleAutoGenerateRenderedMemes()}
                  />
                </div>

                <div className="flex items-center sm:pt-6">
                  <Button
                    onClick={handleAutoGenerateRenderedMemes}
                    disabled={isGeneratingMemes}
                    className={cn(
                      "rounded-full h-10 text-sm font-semibold text-white",
                      "bg-gradient-to-b from-[#7C7EF4] to-[#6F80F0]",
                      "shadow-[0_8px_24px_rgba(91,12,213,0.20),inset_0_8px_10px_rgba(255,255,255,0.22)]",
                      prefersReducedMotion
                        ? ""
                        : "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(91,12,213,0.25)] active:scale-[0.99]"
                    )}
                  >
                    {isGeneratingMemes ? "Generating..." : "Generate 5 Memes"}
                  </Button>
                </div>
              </div>

              {isGeneratingMemes && (
                <div
                  className="rounded-2xl border border-[#E7E5F7] bg-white/70 backdrop-blur-sm p-4 shadow-[0_4px_16px_rgba(27,13,63,0.08)]"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-4 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#301B69]">Generating 5 memes...</div>
                      <div className="text-xs text-[#5A5192] truncate">
                        {clampedFakeProgress >= 99
                          ? "Finalizing (may take longer than usual)..."
                          : `Avg ~${Math.max(1, Math.round(Math.max(averageGenerationMs, MIN_FAKE_DURATION_MS) / 1000))}s • please stay on this tab`}
                      </div>
                    </div>
                    <svg viewBox="0 0 36 36" className="w-12 h-12">
                      <path
                        className="text-[#E7E5F7]"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="none"
                        d="M18 2.0845
                             a 15.9155 15.9155 0 0 1 0 31.831
                             a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-[#7C7EF4]"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray="100"
                        strokeDashoffset={100 - clampedFakeProgress}
                        d="M18 2.0845
                             a 15.9155 15.9155 0 0 1 0 31.831
                             a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <text
                        x="18"
                        y="20.5"
                        textAnchor="middle"
                        className="text-[9px] font-semibold fill-[#301B69]"
                      >
                        {clampedFakeProgress}%
                      </text>
                    </svg>
                  </div>
                  <div className="mt-3 h-3 w-full rounded-full bg-[#E7E5F7] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#7C7EF4] to-[#5E46D8] transition-[width] duration-300"
                      style={{ width: `${clampedFakeProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Niche suggestion chips - single line horizontal scroll */}
              <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <div className="flex gap-2 min-w-max">
                  {nicheSuggestions.map((niche) => (
                    <button
                      key={niche}
                      type="button"
                      onClick={() => {
                        const prefix = memeNiche ? (memeNiche.trim().endsWith("#") ? "" : " ") : "";
                        setMemeNiche(memeNiche + prefix + niche);
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap",
                        "border border-[#E7E5F7] bg-white/40 backdrop-blur-sm",
                        "text-[#301B69] hover:bg-white/60 hover:border-[#7C7EF4]/40",
                        "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
                        prefersReducedMotion ? "" : "transition-all duration-200 active:scale-[0.98]"
                      )}
                    >
                      {niche}
                    </button>
                  ))}
                </div>
              </div>

              {generatedMemes.length > 0 && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-[#301B69]">
                      Results ({generatedMemes.length})
                    </h3>
                  </div>

                  {/* Results - 5 column grid on desktop, horizontal scroll on smaller */}
                  <div className="overflow-x-auto overflow-y-hidden xl:overflow-x-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <div className="meme-results-grid grid gap-4 pb-2">
                      {generatedMemes.map((meme) => (
                        <div
                          key={meme.id}
                          className="relative group flex flex-col"
                          style={{ scrollSnapAlign: "start" }}
                        >
                          <div
                            className={cn(
                              "rounded-[12px] overflow-hidden border bg-white/60 backdrop-blur-sm flex flex-col h-full",
                              "shadow-[0_4px_12px_rgba(27,13,63,0.08)]",
                              selectedMemes.has(meme.id)
                                ? "ring-2 ring-[#7C7EF4] border-[#7C7EF4]"
                                : "border-[#E7E5F7]",
                              prefersReducedMotion ? "" : "transition-all duration-200 hover:shadow-[0_6px_16px_rgba(27,13,63,0.12)]"
                            )}
                          >
                            {/* Loading icon at the top of the card */}
                            {memeLoadingStates.get(meme.id) && (
                              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/70 backdrop-blur-sm">
                                  <Loader2
                                    className={cn(
                                      "w-4 h-4 text-white",
                                      prefersReducedMotion ? "" : "animate-spin"
                                    )}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Video/Image thumb with 9:16 aspect ratio (letterboxed) - larger preview */}
                            <div
                              className="relative bg-black cursor-pointer flex-shrink-0"
                              onClick={() => toggleMemeSelection(meme.id)}
                              title={`${selectedMemes.has(meme.id) ? "Deselect" : "Select"} meme`}
                            >
                              <div className="relative w-full" style={{ aspectRatio: "9/16" }}>
                                <div className="absolute inset-0 flex items-center justify-center p-1 bg-black">
                                  <AuthMediaThumb
                                    full={meme.assets?.full}
                                    thumb={meme.assets?.thumb}
                                    thumbIsVideo={meme.thumbIsVideo}
                                    className="w-full h-full object-contain pointer-events-none"
                                    title=""
                                    onLoadingStateChange={(isLoading) => {
                                      setMemeLoadingStates((prev) => {
                                        const next = new Map(prev);
                                        if (isLoading) {
                                          next.set(meme.id, true);
                                        } else {
                                          next.delete(meme.id);
                                        }
                                        return next;
                                      });
                                    }}
                                  />
                                </div>

                                {/* Pulsing loading overlay */}
                                {memeLoadingStates.get(meme.id) && (
                                  <div
                                    className={cn(
                                      "absolute inset-0 bg-gradient-to-br from-[#F5F0FF] to-[#E8E0F5] pointer-events-none",
                                      prefersReducedMotion ? "opacity-60" : "animate-pulse-soft"
                                    )}
                                    style={{ zIndex: 1 }}
                                  />
                                )}

                                {/* Play button - opens preview, only covers icon area */}
                                <button
                                  type="button"
                                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openPreviewFor(meme.filename || meme.id, meme.assets?.full);
                                  }}
                                  title="Play video preview"
                                >
                                  <span className={cn(
                                    "flex items-center justify-center w-12 h-12 rounded-full",
                                    "bg-black/60 text-white opacity-80 hover:opacity-100",
                                    prefersReducedMotion ? "" : "transition-opacity duration-200"
                                  )}>
                                    <Play className="w-6 h-6" />
                                  </span>
                                </button>

                                {/* Top-left checkbox - also toggles selection, stops propagation to prevent double-toggle */}
                                <button
                                  type="button"
                                  className={cn(
                                    "absolute top-2 left-2 inline-flex items-center justify-center rounded-full p-1.5 text-white z-20",
                                    selectedMemes.has(meme.id)
                                      ? "bg-[#7C7EF4] opacity-100"
                                      : "bg-black/60 opacity-0 group-hover:opacity-100",
                                    prefersReducedMotion ? "" : "transition-opacity duration-200"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleMemeSelection(meme.id);
                                  }}
                                  title={`${selectedMemes.has(meme.id) ? "Deselect" : "Select"} meme`}
                                  aria-pressed={selectedMemes.has(meme.id)}
                                >
                                  <Check className="w-4 h-4" />
                                  <span className="sr-only">{selectedMemes.has(meme.id) ? "Deselect meme" : "Select meme"}</span>
                                </button>

                              </div>
                            </div>

                            {/* Meme title/caption - improved typography with fixed height */}
                            <div className="px-2 pt-2 pb-1.5 min-h-[44px] flex items-start flex-shrink-0">
                              {meme.text ? (
                                <div className="text-sm font-semibold text-[#301B69] line-clamp-2 leading-snug">
                                  {meme.text}
                                </div>
                              ) : meme.filename && !meme.filename.match(/^[a-f0-9]{32,}$/i) ? (
                                <div className="text-sm font-semibold text-[#301B69] line-clamp-2 leading-snug">
                                  {meme.filename}
                                </div>
                              ) : (
                                <div className="text-sm font-semibold text-[#301B69] line-clamp-2 leading-snug opacity-0">
                                  {/* Placeholder to maintain height */}
                                  &nbsp;
                                </div>
                              )}
                            </div>

                            {/* Regenerate button - polished with fixed height */}
                            <div className="px-2 pb-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleRegenerateMeme(meme.id)}
                                disabled={regeneratingMemeId === meme.id}
                                title="Get a different template"
                                className={cn(
                                  "w-full px-3 py-1.5 rounded-full text-xs font-medium h-[32px]",
                                  "border border-[#E7E5F7] bg-white/50 backdrop-blur-sm",
                                  "text-[#301B69]",
                                  "hover:bg-white/70 hover:border-[#7C7EF4] hover:shadow-[0_2px_8px_rgba(124,126,244,0.15)]",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                  prefersReducedMotion ? "" : "transition-all duration-200 active:scale-[0.97]"
                                )}
                              >
                                {regeneratingMemeId === meme.id ? "Regenerating..." : "Regenerate"}
                              </button>
                            </div>
                          </div>

                          {regeneratingMemeId === meme.id && (
                            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center rounded-[12px]">
                              <div className="text-sm text-[#301B69] font-medium">Regenerating...</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isGeneratingMemes && generatedMemes.length === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 rounded-lg" />
                  ))}
                </div>
              )}

              {/* Debug info */}
              {!isGeneratingMemes && generatedMemes.length === 0 && (
                <div className="text-sm text-[#5A5192] text-center py-8">
                  No memes generated yet. Click "Generate 5 Memes" to create memes.
                </div>
              )}
            </div>
          </div>

          {/* results */}
          <div>
            {videoSummary && (
              <div className="mt-6">
                <Label className="text-base font-medium text-[#301B69]">Summary</Label>
                <div className="mt-2 p-4 bg-white/40 backdrop-blur-sm rounded-[12px] border border-[#E7E5F7]">
                  <p className="text-sm text-[#5A5192] whitespace-pre-line">{videoSummary}</p>
                </div>
              </div>
            )}
            {memeOptions.length > 0 && (
              <div className="mt-6">
                <Label className="text-base font-medium mb-3 block text-[#301B69]">Funny Meme Options</Label>
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-2">
                  {memeOptions.map((option, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      className={cn(
                        "justify-start h-auto py-2 px-3 text-left rounded-[12px]",
                        "border-[#E7E5F7] bg-white/40 backdrop-blur-sm",
                        selectedMemeOption === option
                          ? "border-[#7C7EF4] bg-[#7C7EF4]/10 text-[#301B69]"
                          : "text-[#5A5192] hover:bg-white/60",
                        prefersReducedMotion ? "" : "transition-all duration-200"
                      )}
                      onClick={() => {
                        // Choosing a meme option should NOT require auth
                        setSelectedMemeOption(option);
                      }}
                    >
                      <span className="text-sm">
                        {option}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - smaller, only Add to Library */}
        {generatedMemes.length > 0 && (
          <div className="border-t border-[#E7E5F7]/40 bg-white/60 backdrop-blur-sm px-4 py-2.5 shrink-0">
            <Button
              type="button"
              onClick={handleScheduleNow}
              disabled={selectedMemes.size === 0 || scheduling}
              className={cn(
                "w-full rounded-full h-9 text-sm font-semibold text-white",
                "bg-gradient-to-b from-[#7C7EF4] to-[#6F80F0]",
                "shadow-[0_8px_24px_rgba(91,12,213,0.20),inset_0_8px_10px_rgba(255,255,255,0.22)]",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                prefersReducedMotion
                  ? ""
                  : "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(91,12,213,0.25)] active:scale-[0.99]"
              )}
            >
              <Calendar className="w-4 h-4 mr-2" />
              {scheduling ? "Adding..." : `Add to Library (${selectedMemes.size})`}
            </Button>
          </div>
        )}

        {/* no inline coachmark in modal — handled at app level */}
      </DialogContent>

      {/* ---------- Video Preview ---------- */}
      <Dialog
        open={previewOpen && !!previewBlobUrl}
        onOpenChange={(o) => {
          if (!o) closePreview();
        }}
      >
        <DialogContent className="sm:max-w-3xl p-0 bg-black/80">
          <DialogHeader className="sr-only">
            <DialogTitle>Video preview</DialogTitle>
            <DialogDescription>Authenticated full-screen preview of the selected meme.</DialogDescription>
          </DialogHeader>
          <button
            className="absolute right-3 top-3 z-50 text-white bg-black/70 p-2 rounded-full hover:bg-black transition"
            onClick={() => closePreview()}
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <video
            ref={previewVideoRef}
            src={previewBlobUrl ?? undefined}
            controls
            autoPlay
            className="w-full max-h-[80vh] rounded-xl shadow-xl"
            crossOrigin="anonymous"
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
