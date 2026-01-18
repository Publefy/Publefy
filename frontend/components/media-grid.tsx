"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Trash2, Loader2 } from "lucide-react";
import { apiServiceDefault } from "@/services/api/api-service";
import { API_BASE, CLOUD_RUN_BASE, MEDIA_BASE } from "@/services/api/apiConfig";
import { getAuthToken } from "@/utils/getAuthToken";
import { VideoItemUi } from "@/types/video-item";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";


const isPublefyHost = (value: string) => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "publefy.vercel.app" || host.endsWith(".publefy.vercel.app");
  } catch {
    return false;
  }
};

function toApiMediaUrl(raw?: string | null): string {
  if (!raw) return "";

  const mediaBase = (MEDIA_BASE || API_BASE || CLOUD_RUN_BASE || "").replace(/\/+$/, "");
  const apiBase = API_BASE.replace(/\/+$/, "");

  const buildFromPath = (path: string, query: string) => {
    const trimmed = path.replace(/^\/+/, "");

    // Logic for direct finalized uploads: root-level reel_... files
    // These are currently blocked by the proxy, so we use the functional /video/download/ endpoint.
    // We catch both raw filenames ("reel_...") and broken proxy paths ("memes/media/reel_...")
    if (trimmed.includes("reel_") && !trimmed.split("reel_")[1]?.includes("/")) {
      const filename = trimmed.substring(trimmed.lastIndexOf("/") + 1);
      if (!apiBase) return `/video/download/${filename}${query}`;
      return `${apiBase}/video/download/${filename}${query}`;
    }

    // Already routed through the media proxy
    if (trimmed.startsWith("memes/media/")) {
      if (!mediaBase) return `/${trimmed}${query}`;
      return `${mediaBase}/${trimmed}${query}`;
    }

    // Common blob prefixes that should be served via /memes/media/
    const needsProxy = ["instagram_reels/", "bank-mem/", "processed_videos/", "users/"].some((p) =>
      trimmed.startsWith(p)
    );
    if (needsProxy) {
      const encoded = trimmed.split("/").map(encodeURIComponent).join("/");
      if (!mediaBase) return `/memes/media/${encoded}${query}`;
      return `${mediaBase}/memes/media/${encoded}${query}`;
    }

    // Fallback: join with API base
    if (!apiBase) return `/${trimmed}${query}`;
    return `${apiBase}/${trimmed}${query}`;
  };

  // If absolute and from publefy.vercel.app, rewrite through our proxy/base instead of hitting publefy.vercel.app directly
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (isPublefyHost(raw)) {
        return buildFromPath(url.pathname, url.search);
      }
    } catch {
      // fall through to relative handling
    }
    return raw;
  }

  // Relative or non-publefy absolute paths
  return buildFromPath(raw, "");
}

function deriveInstagramReelThumb(source?: string | null): string | null {
  if (!source || !/instagram_reels\//i.test(source)) return null;
  const noHash = source.split("#")[0] || "";
  const [path, query] = noHash.split("?");
  if (!/\.mp4$/i.test(path)) return null;
  const jpgPath = path.replace(/\.mp4$/i, ".jpg");
  return query ? `${jpgPath}?${query}` : jpgPath;
}

function getOrigin(value?: string): string {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch {
    const trimmed = value.trim();
    const match = trimmed.match(/^https?:\/\/([^/]+)/i);
    return match ? match[0].replace(/\/$/, "") : "";
  }
}

function shouldAttachAuth(url: string): boolean {
  const targetOrigin = getOrigin(url);
  if (!targetOrigin) return false;
  const origins = new Set(
    [API_BASE, MEDIA_BASE, typeof window !== "undefined" ? window.location.origin : undefined]
      .map(getOrigin)
      .filter((value): value is string => !!value)
  );
  return origins.has(targetOrigin);
}

async function fetchAsObjectURL(url: string): Promise<string> {
  const headers: Record<string, string> = {};
  const init: RequestInit = { mode: "cors" };
  if (shouldAttachAuth(url)) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    init.credentials = "include";
  }
  const res = await fetch(url, { ...init, headers, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

type CachedVideo = { src: string; isObjectUrl: boolean };
const videoSrcCache = new Map<string, CachedVideo>();
const videoSrcInflight = new Map<string, Promise<CachedVideo>>();

async function resolveVideoSrc(url: string): Promise<CachedVideo> {
  if (!shouldAttachAuth(url)) {
    return { src: url, isObjectUrl: false };
  }

  const cached = videoSrcCache.get(url);
  if (cached) return cached;

  const inflight = videoSrcInflight.get(url);
  if (inflight) return inflight;

  const promise = (async () => {
    const objUrl = await fetchAsObjectURL(url);
    const entry: CachedVideo = { src: objUrl, isObjectUrl: true };
    videoSrcCache.set(url, entry);
    return entry;
  })();

  videoSrcInflight.set(url, promise);
  return promise.finally(() => {
    videoSrcInflight.delete(url);
  });
}

/**
 * Hook for images/thumbnails: returns direct URL (no blob fetch)
 * For images that need auth, we'll use a fetch-based approach with credentials
 */
function useAuthImageUrl(source?: string | null): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setImageUrl(null);
      return;
    }

    const normalized = toApiMediaUrl(source);

    // If auth is needed, fetch as blob (thumbnails are small, so this is acceptable)
    // Otherwise, use direct URL
    if (shouldAttachAuth(normalized)) {
      let cancelled = false;
      let revoke: string | null = null;

      const loadImage = async () => {
        try {
          const objUrl = await fetchAsObjectURL(normalized);
          if (cancelled) {
            URL.revokeObjectURL(objUrl);
            return;
          }
          revoke = objUrl;
          setImageUrl(objUrl);
        } catch {
          if (!cancelled) {
            // Fallback to direct URL if blob fetch fails
            setImageUrl(normalized);
          }
        }
      };

      loadImage();
      return () => {
        cancelled = true;
        if (revoke) {
          URL.revokeObjectURL(revoke);
        }
      };
    } else {
      // No auth needed, use direct URL
      setImageUrl(normalized);
    }
  }, [source]);

  return imageUrl;
}

/** Safe helper: produce a thumbnail once metadata is loaded, then seek (used only for drag image) */
async function getVideoThumbnail(videoUrl: string, seekTo = 0.5): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.src = videoUrl;
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
    };

    video.onloadedmetadata = () => {
      try {
        const clamped = Math.min(Math.max(seekTo, 0), Math.max(0.01, (video.duration || 1) - 0.01));
        video.currentTime = clamped;
      } catch {
        setTimeout(() => {
          try {
            video.currentTime = seekTo;
          } catch {
            video.currentTime = 0;
          }
        }, 0);
      }
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 180;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No 2D context");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const img = new Image();
        img.src = canvas.toDataURL();
        img.width = 90;
        img.height = 90;
        cleanup();
        resolve(img);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Could not load video"));
    };
  });
}

interface MediaGridProps {
  items: VideoItemUi[];
  setItems: (items: VideoItemUi[]) => void;
  /** The Instagram account id to scope requests to (optional; we auto-resolve if omitted) */
  igId?: string;
  /** Allow parent to open a post editor when a video tile is clicked */
  onVideoSelect?: (video: VideoItemUi, origin?: DOMRect | ClientRect) => void;
}

function getFromLS<T = any>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
  } catch { return null; }
}

export function MediaGrid({ items, setItems, igId, onVideoSelect }: MediaGridProps) {
  const [loading, setLoading] = useState(false);
  const [resolvedIgId, setResolvedIgId] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  // Track loaded state for images and videos separately, per tile
  const [imgLoadedById, setImgLoadedById] = useState<Record<string, boolean>>({});
  const [imgFailedById, setImgFailedById] = useState<Record<string, boolean>>({});
  const [videoLoadedById, setVideoLoadedById] = useState<Record<string, boolean>>({});

  const markImgLoaded = (id: string) => setImgLoadedById((m) => (m[id] ? m : { ...m, [id]: true }));
  const markImgFailed = (id: string) => setImgFailedById((m) => (m[id] ? m : { ...m, [id]: true }));
  const markVideoLoaded = (id: string) => setVideoLoadedById((m) => (m[id] ? m : { ...m, [id]: true }));

  const handleToggleSelect = (
    id: string,
    e?: React.MouseEvent,
    nextChecked?: boolean | "indeterminate"
  ) => {
    if (e) {
      e.stopPropagation();
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const shouldSelect =
        typeof nextChecked === "boolean"
          ? nextChecked
          : nextChecked === "indeterminate"
            ? true
            : !next.has(id);

      if (shouldSelect) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = items.map((item) => item.id);
    setSelectedIds(new Set(allIds));
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0 || isDeleting) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected video(s)?`)) {
      return;
    }

    setIsDeleting(true);
    let successCount = 0;
    let failCount = 0;

    const idsToDelete = Array.from(selectedIds);

    for (const id of idsToDelete) {
      try {
        // Find the item to get its reel_id
        const item = items.find(it => it.id === id);
        const deleteId = item?.reel_id || id;

        const url = igId
          ? `/video/delete/${deleteId}?ig_id=${encodeURIComponent(igId)}`
          : `/video/delete/${deleteId}`;

        await apiServiceDefault.delete(url);
        successCount++;
      } catch (err) {
        console.error(`Failed to delete video ${id}:`, err);
        failCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Success",
        description: `Successfully deleted ${successCount} video(s).`,
      });
      setSelectedIds(new Set());
      // Refresh the list
      await fetchMyVideos();
      // Notify other components (like the Reels tab if it existed or just for consistency)
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("videos:updated", { detail: { igId: igId || undefined } })
        );
      }
    }

    if (failCount > 0) {
      toast({
        title: "Partial Failure",
        description: `Failed to delete ${failCount} video(s).`,
        variant: "destructive",
      });
    }

    setIsDeleting(false);
  };

  // --------- Thumbnail resolver ----------
  const getThumbUrl = (item: any): string | null => {
    const directThumb =
      item.thumbnail_url ||
      item.thumb ||
      item.thumbnail ||
      deriveInstagramReelThumb(item.video_url);

    // Some feeds incorrectly point thumbnails to profile-picture endpoints; skip to avoid 404s
    if (directThumb && /(^|\/)instagram\/profile-picture\//i.test(directThumb)) {
      return null;
    }

    if (directThumb) return toApiMediaUrl(directThumb);
    return null;
  };

  // Map any reel document to a stable UI shape
  const toVideoItem = (item: any, fallbackIndex: number): VideoItemUi => {
    // Prioritize functional download paths / path fields over broken proxy URLs
    const rawVideo =
      item.video_path ||
      item.video_url ||
      item.final_video_path ||
      item.final_video_url ||
      "";
    const videoUrl = toApiMediaUrl(rawVideo);
    const inferredThumb = deriveInstagramReelThumb(rawVideo);
    const thumb = item.thumbnail_url || item.thumb || item.thumbnail || inferredThumb;

    const v = new VideoItemUi();
    v.id = item.reel_id ?? String(fallbackIndex);
    v.video_url = videoUrl;

    // Remap metadata fields per backend trace
    v.summary = item.summary || "";
    const caption = item.caption || (item.funny_meme_options && item.funny_meme_options.length > 0 ? item.funny_meme_options[0] : "");
    (v as any).caption = caption;
    (v as any).reel_id = item.reel_id;
    (v as any).final_video_url = item.final_video_url;
    (v as any).thumbnail_url = thumb;
    (v as any).thumb = thumb;
    v.type = "video";
    return v;
  };

  // Fetch data whenever igId changes
  const fetchMyVideos = useCallback(async () => {
    setLoading(true);
    // Clear items immediately to avoid "flickering" between different libraries
    setItems([]);

    try {
      const url = igId
        ? `/video/my-videos?ig_id=${encodeURIComponent(igId)}&limit=48`
        : `/video/my-videos?limit=48`;

      const res = await apiServiceDefault.get(url);
      const videos = (res as any)?.videos || (res as any)?.data?.videos || [];

      let data: VideoItemUi[] = videos.map((item: any, i: number) => {
        const vi = toVideoItem(item, i);
        // Attach raw profile info if available for filtering
        (vi as any).raw_ig_id = item.ig_id || item.instagram_id || item.profile_ig_id;
        return vi;
      });

      // Strict Frontend Filtering:
      // Prevent "Guest" videos from showing in "Account" views and vice versa.
      if (igId) {
        data = data.filter(v => (v as any).raw_ig_id === igId);
      } else {
        data = data.filter(v => !(v as any).raw_ig_id);
      }

      // Deduplicate by ID to prevent React key collision errors
      const seenIds = new Set();
      const uniqueData = data.filter(v => {
        if (seenIds.has(v.id)) return false;
        seenIds.add(v.id);
        return true;
      });

      setItems(uniqueData);
      // reset per-tile states
      setImgLoadedById({});
      setImgFailedById({});
      setVideoLoadedById({});
    } catch (error) {
      console.error("Failed to fetch my videos:", error);
      toast({
        title: "Could not load videos",
        description: "Please try again.",
        variant: "destructive",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [igId, setItems, toast]);

  useEffect(() => {
    fetchMyVideos();
  }, [fetchMyVideos]);

  // listen for "videos:updated" and refresh
  useEffect(() => {
    const onVideosUpdated = (e: Event) => {
      const { igId: changedIgId } = (e as CustomEvent).detail || {};
      // Refresh if the update matches our current view (or if both are "guest")
      if (!changedIgId && !igId) {
        fetchMyVideos();
      } else if (changedIgId === igId) {
        fetchMyVideos();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("videos:updated", onVideosUpdated as EventListener);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("videos:updated", onVideosUpdated as EventListener);
      }
    };
  }, [igId, fetchMyVideos]);

  const handleDragStart = async (e: React.DragEvent, item: VideoItemUi) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
    try {
      const dragImg = await getVideoThumbnail(item.video_url, 0.5);
      e.dataTransfer.setDragImage(dragImg, dragImg.width / 2, dragImg.height / 2);
    } catch {
      // fallback
    }
    document.body.classList.add("dragging");
  };

  const handleDragEnd = () => {
    document.body.classList.remove("dragging");
  };

  return (
    <div className="w-full space-y-2">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-2 bg-white/80 backdrop-blur-md border border-[#E7E5F7]/60 rounded-xl shadow-[0_4px_12px_rgba(27,13,63,0.06)] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col pl-1 shrink-0">
            <span className="text-[11px] font-bold text-[#301B69] leading-tight">
              {selectedIds.size} {selectedIds.size === 1 ? "video" : "videos"}
            </span>
            <span className="text-[10px] text-[#5A5192] leading-tight font-medium">selected</span>
          </div>

          <div className="flex items-center gap-0.5 min-w-0">
            {selectedIds.size < items.length && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-8 px-2 text-[11px] font-semibold text-[#7C7EF4] hover:text-[#301B69] hover:bg-[#7C7EF4]/10 shrink-0"
              >
                Select All
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={isDeleting}
              className="h-8 px-2 text-[11px] font-semibold text-[#5A5192] hover:text-[#301B69] shrink-0"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="h-8 px-2.5 text-[11px] font-bold gap-1 shadow-sm shrink-0"
            >
              {isDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Loading / Empty states */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full h-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="w-full py-10 text-center text-sm text-[#5A5192]">
          {resolvedIgId ? "No videos for this account yet." : "No videos in your library yet."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-1">
          {items.map((item: any, index) => (
            <GridTile
              key={item.id ?? index}
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggleSelect={(e, checked) => handleToggleSelect(item.id, e, checked)}
              imgLoaded={!!imgLoadedById[item.id]}
              imgFailed={!!imgFailedById[item.id]}
              videoLoaded={!!videoLoadedById[item.id]}
              getThumbUrl={getThumbUrl}
              onImgLoad={() => markImgLoaded(item.id)}
              onImgError={() => markImgFailed(item.id)}
              onVideoLoaded={() => markVideoLoaded(item.id)}
              onClick={(event) => {
                const rect = event?.currentTarget?.getBoundingClientRect?.();
                if (onVideoSelect) {
                  onVideoSelect(item, rect || undefined);
                }
              }}
              handleDragStart={(e) => handleDragStart(e, item)}
              handleDragEnd={handleDragEnd}
              prefersReducedMotion={prefersReducedMotion ?? undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Single grid tile that:
 * - shows image first if available
 * - falls back to a lazily-loaded <video> if image is missing or fails
 * - shows a spinner until the image or the video is ready
 */
function GridTile(props: {
  item: any;
  isSelected: boolean;
  onToggleSelect: (e?: React.MouseEvent, checked?: boolean | "indeterminate") => void;
  imgLoaded: boolean;
  imgFailed: boolean;
  videoLoaded: boolean;
  getThumbUrl: (item: any) => string | null;
  onImgLoad: () => void;
  onImgError: () => void;
  onVideoLoaded: () => void;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  handleDragStart: (e: React.DragEvent) => void;
  handleDragEnd: () => void;
  prefersReducedMotion?: boolean;
}) {
  const {
    item, isSelected, onToggleSelect, imgLoaded, imgFailed, videoLoaded,
    getThumbUrl, onImgLoad, onImgError, onVideoLoaded,
    onClick,
    handleDragStart, handleDragEnd, prefersReducedMotion = false
  } = props;

  const thumb = getThumbUrl(item);
  const thumbUrl = useAuthImageUrl(thumb); // Direct URL, may use blob for auth (thumbnails are small)
  const videoUrl = item.video_url ? toApiMediaUrl(item.video_url) : null;
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoPoster, setVideoPoster] = useState<string | null>(null);
  const videoRequestRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    // reset state when the underlying video changes
    setVideoSrc(null);
    setVideoPoster(null);
    videoRequestRef.current = null;
  }, [videoUrl, thumbUrl]);

  const ensureVideoSrc = useCallback(() => {
    if (!videoUrl) return;
    if (videoSrc || videoRequestRef.current) return;
    const req = resolveVideoSrc(videoUrl)
      .then((resolved) => {
        setVideoSrc(resolved.src);
        setVideoPoster((prev) => prev || thumbUrl || null);
      })
      .catch(() => {
        // ignore errors; tile will stay with poster/placeholder
      })
      .finally(() => {
        videoRequestRef.current = null;
      });
    videoRequestRef.current = req;
  }, [videoUrl, videoSrc, thumbUrl]);

  // Only prepare video URL if thumbnail is missing or failed
  // But don't set src until user interacts
  useEffect(() => {
    if (!thumb || imgFailed) {
      if (videoUrl) {
        setVideoPoster(thumbUrl); // Use thumbnail as poster if available
        // Auto-load video if no usable thumbnail so the tile still shows media
        ensureVideoSrc();
      }
    } else {
      setVideoSrc(null);
      setVideoPoster(null);
    }
  }, [thumb, imgFailed, videoUrl, thumbUrl, ensureVideoSrc]);

  const showImage = !!thumbUrl && !imgFailed;
  const showVideo = !showImage && !!videoUrl;

  return (
    <div
      className={cn(
        "relative aspect-square cursor-pointer group rounded-[12px] overflow-hidden",
        "bg-white border border-[#E7E5F7]/40 shadow-[0_4px_12px_rgba(27,13,63,0.08)]",
        prefersReducedMotion
          ? ""
          : "transition-all duration-200 hover:shadow-[0_6px_16px_rgba(27,13,63,0.12)] hover:scale-[1.02] active:scale-[0.99]"
      )}
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {showImage ? (
        <>
          <img
            src={thumbUrl || undefined}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={onImgLoad}
            onError={() => {
              onImgError();
              ensureVideoSrc();
            }}
            className={`w-full h-full object-cover transition-all duration-200 group-hover:opacity-90 ${imgLoaded ? "opacity-100" : "opacity-0"
              }`}
          />
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </div>
          )}
        </>
      ) : showVideo ? (
        <>
          {/* Video fallback — only load when user interacts to avoid downloading */}
          {videoPoster && !videoSrc ? (
            // Show poster image until user interacts
            <img
              src={videoPoster}
              alt=""
              className="w-full h-full object-cover"
              onError={() => {
                // If poster fails, prepare to show video placeholder
                setVideoPoster(null);
              }}
            />
          ) : videoSrc ? (
            // Video is loading/loaded
            <video
              src={videoSrc}
              className={`w-full h-full object-cover transition-all duration-200 group-hover:opacity-90 ${videoLoaded ? "opacity-100" : "opacity-0"
                }`}
              muted
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              onLoadedMetadata={onVideoLoaded}
              onLoadedData={onVideoLoaded}
              onCanPlay={onVideoLoaded}
              onError={onVideoLoaded}
            />
          ) : (
            // Placeholder
            <div className="w-full h-full bg-gray-200" />
          )}
          {/* Load video on hover or click */}
          <div
            className="absolute inset-0"
            onMouseEnter={() => {
              ensureVideoSrc();
            }}
            onClick={() => {
              ensureVideoSrc();
            }}
          />
          {!videoLoaded && videoSrc && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Placeholder while waiting */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          </div>
        </>
      )}

      {/* Overlay UI */}
      <div className="absolute inset-0 transition-colors duration-200 bg-black/0 group-hover:bg-black/6">
        {/* Selection Checkbox */}
        <div
          className={cn(
            "absolute top-2 left-2 z-10 transition-all duration-200",
            isSelected ? "opacity-100 scale-100" : "opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(e, !isSelected);
          }}
        >
          <div className={cn(
            "flex items-center justify-center w-6 h-6 rounded-full border shadow-sm transition-colors",
            isSelected
              ? "bg-[#301B69] border-[#301B69] text-white"
              : "bg-white/80 backdrop-blur-sm border-white/40 text-[#301B69] hover:bg-white"
          )}>
            <Checkbox
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={(checked) => onToggleSelect(undefined, checked)}
              className={cn(
                "w-4 h-4 rounded-full border-none data-[state=checked]:bg-transparent data-[state=checked]:text-white",
                !isSelected && "opacity-0"
              )}
            />
            {!isSelected && <div className="absolute inset-0 rounded-full border-2 border-[#301B69]/20" />}
          </div>
        </div>

      </div>
    </div>
  );
}
