"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Settings, MessageSquare } from "lucide-react";
import ProfileSelector from "@/components/profile-selector";
import { CalendarView } from "@/components/calendar-view";
import PostEditor from "@/components/post-editor";
import { MediaGrid } from "@/components/media-grid";
import { VideoItemUi } from "@/types/video-item";
import type { Profile } from "@/types/profile";
import { ScheduledPost } from "@/types/scheduled-post";
import { apiServiceDefault } from "@/services/api/api-service";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { BetterOnDesktopModal } from "@/components/BetterOnDesktopModal";

const VideoProcessorModal = dynamic(
  () => import("./video-processor-modal").then((m) => m.VideoProcessorModal),
  { ssr: false }
);
const VideoUploadModal = dynamic(
  () => import("./VideoUploadModal").then((m) => m.VideoUploadModal),
  { ssr: false }
);

// ---------- Skeleton ----------
const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse ${className}`} />
);

interface DashboardProps {
  onDashboardLogout?: () => void;
}

export default function Dashboard({ onDashboardLogout }: DashboardProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [videoProcessorOpen, setVideoProcessorOpen] = useState(false);
  const [videoUploadOpen, setVideoUploadOpen] = useState(false);
  const [coachmarkAddAccount, setCoachmarkAddAccount] = useState(false);
  const [coachmarkMessage, setCoachmarkMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"calendar" | "media">("media");

  const [mediaItems, setMediaItems] = useState<VideoItemUi[]>([]);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [quickEditorPost, setQuickEditorPost] = useState<ScheduledPost | null>(null);
  const [quickEditorVideo, setQuickEditorVideo] = useState<VideoItemUi | null>(null);
  const [quickEditorOpen, setQuickEditorOpen] = useState(false);
  const [quickEditorOrigin, setQuickEditorOrigin] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [usage, setUsage] = useState({ points_balance: 0, points_total_limit: 0 });
  const [user, setUser] = useState<any>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const data = await apiServiceDefault.get<any>("/auth/me");
      if (data) {
        if (data.usage) {
          setUsage(data.usage);
        }
        if (data.subscription) {
          setUser({ subscription: data.subscription });
        }
      }
    } catch (error) {
      console.error("Failed to fetch usage:", error);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const { toast } = useToast();
  // Show the boot skeleton only while we don't know which profile to render.
  const isBootLoading = loadingProfiles;

  // ---------- Helpers ----------
  const safeData = <T,>(res: any, key?: string): T => {
    if (!res) return [] as unknown as T;
    if (key) return (res?.[key] ?? res?.data?.[key] ?? []) as T;
    return (res?.data ?? res) as T;
  };

  // ---------- Profiles ----------
  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    try {
      const res = await apiServiceDefault.get("profiles/list");
      const profiles = safeData<Profile[]>(res, "profiles").length
        ? safeData<Profile[]>(res, "profiles")
        : safeData<Profile[]>(res);

      setAvailableProfiles(profiles || []);

      // Check if we are in a reload/redirect state
      const urlParams = new URL(window.location.href).searchParams;
      const isReloading = urlParams.get('reload_profiles') === 'true';

      // Rehydrate previously selected profile by id
      const savedId = typeof window !== "undefined" ? localStorage.getItem("selectedProfileId") : null;
      let next: Profile | null = null;

      if (isReloading) {
        // Find the "newest" or most relevant profile (prioritize platforms over guest)
        next = profiles.find(p => p.platform === 'instagram') ||
          profiles.find(p => p.platform === 'facebook') ||
          profiles[0] || null;
      } else if (savedId) {
        next = profiles.find((p) => p.id === savedId) ?? null;
      }

      if (!next && profiles.length) {
        next = profiles[0];
      }

      setSelectedProfile(next ?? null);

      if (next?.ig_id) localStorage.setItem("selectedProfileIgId", next.ig_id);
      if (next?.id) localStorage.setItem("selectedProfileId", next.id);
    } catch (error: any) {
      const url = new URL(window.location.href);
      const isAuthTransition = url.searchParams.has("access_token") || url.hash.includes("access_token");

      if (error?.response?.status === 401 && !isAuthTransition) {
        onDashboardLogout?.();
      } else {
        // Check for duplicate key errors - these are usually safe to ignore
        const errorMessage = error?.response?.data?.error || error?.message || '';
        if (errorMessage.includes('E11000') || errorMessage.includes('duplicate key')) {
          console.log("ℹ️ Profile already exists. This is normal if reconnecting an account.");
        } else {
          console.error("Error loading profiles:", error);
        }
      }
    } finally {
      setLoadingProfiles(false);
    }
  }, [onDashboardLogout]);

  // ---------- Scheduled posts ----------
  const fetchScheduledPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const res = await apiServiceDefault.get("instagram/scheduled-posts");
      const posts = safeData<ScheduledPost[]>(res);
      setScheduledPosts(Array.isArray(posts) ? posts : []);
    } catch (error: any) {
      const url = new URL(window.location.href);
      const isAuthTransition = url.searchParams.has("access_token") || url.hash.includes("access_token");

      if (error?.response?.status === 401 && !isAuthTransition) {
        onDashboardLogout?.();
      } else {
        console.error("Error loading scheduled posts:", error);
      }
    } finally {
      setLoadingPosts(false);
    }
  }, [onDashboardLogout]);

  // ---------- Boot load ----------
  useEffect(() => {
    // Kick off both requests in parallel so login isn't blocked by the slower one.
    fetchProfiles();
    fetchScheduledPosts();
  }, [fetchProfiles, fetchScheduledPosts]);

  // Check for reload_profiles flag after Facebook login
  useEffect(() => {
    const checkReloadFlag = () => {
      if (typeof window === 'undefined') return;

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('reload_profiles') === 'true') {
        // Remove the flag from URL
        urlParams.delete('reload_profiles');
        const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
        window.history.replaceState({}, '', newUrl);

        // Reload profiles to include the newly linked Facebook account
        fetchProfiles();
      }
    };

    checkReloadFlag();
  }, [fetchProfiles]);

  // Check for Instagram connection status (error/cancel)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const connectionStatus = urlParams.get('instagram_connection');

    if (connectionStatus === 'cancelled') {
      toast({
        title: "Instagram was not connected",
        description: "The connection process was cancelled. You can try again anytime.",
        variant: "default",
      });

      // Remove the flag from URL
      urlParams.delete('instagram_connection');
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [toast]);

  // Auto-open processor after login resume (from landing) and show coachmark if no profile
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const shouldResume = sessionStorage.getItem("resumeVideoProcessor");
      const shouldOpen = sessionStorage.getItem("resumeVideoProcessorOpen");
      if (shouldResume || shouldOpen) {
        setVideoProcessorOpen(true);
        // Clear one-shot open flag; keep resume state until finalize
        sessionStorage.removeItem("resumeVideoProcessorOpen");
      }
      const onCoachmark = (e: Event) => {
        // Guard: only show from explicit modal finalize intent
        const src = (e as CustomEvent)?.detail?.source;
        if (src === "modal-finalize") {
          setCoachmarkMessage(null);
          setCoachmarkAddAccount(true);
        } else if (src === "calendar-drop") {
          setCoachmarkMessage("Connect an Instagram account to enable scheduling features.");
          setCoachmarkAddAccount(true);
        }
      };
      window.addEventListener("coachmark:add-account", onCoachmark as any);
      return () => window.removeEventListener("coachmark:add-account", onCoachmark as any);
    } catch { }
  }, [selectedProfile]);

  // Close the inline editor if the selected profile changes
  useEffect(() => {
    if (selectedProfile && quickEditorPost && quickEditorPost.profile_id !== selectedProfile.id) {
      setQuickEditorOpen(false);
      setQuickEditorPost(null);
      setQuickEditorVideo(null);
      setQuickEditorOrigin(null);
    }
  }, [quickEditorOpen, quickEditorPost, quickEditorVideo, selectedProfile]);

  // ---------- Callbacks ----------
  const handleNewVideoGenerated = useCallback((videoUrl: string) => {
    const newItem = new VideoItemUi();
    newItem.id = `media-${Date.now()}`;
    newItem.video_url = videoUrl;
    newItem.type = "video";
    newItem.selected = false;
    setMediaItems((prev) => [newItem, ...prev]);
    fetchUsage(); // Refresh usage after generation
  }, [fetchUsage]);

  const handleDateChange = useCallback((date: Date) => {
    setCurrentDate(date);
  }, []);

  const handlePostUpdate = useCallback((updatedPost: ScheduledPost) => {
    setScheduledPosts((prev) => (prev ? prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)) : prev));
  }, []);

  const handlePostDelete = useCallback((postId: string) => {
    setScheduledPosts((prev) => (prev ? prev.filter((p) => p.id !== postId) : prev));
  }, []);

  const ensureQuickEditorPost = useCallback(async (): Promise<ScheduledPost | null> => {
    if (!quickEditorVideo || !selectedProfile?.id) return null;
    const reelId = quickEditorVideo.reel_id || quickEditorVideo.id;
    if (!reelId) return null;

    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const existing = scheduledPosts.find(
      (p) => p.reel_id === reelId && p.profile_id === selectedProfile.id
    );
    if (existing) {
      setQuickEditorPost(existing);
      return existing;
    }

    const draftPayload = {
      reel_id: reelId,
      profile_id: selectedProfile.id,
      scheduled_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      caption: (quickEditorVideo as any).caption ?? (quickEditorVideo as any).summary ?? "",
      hashtags: Array.isArray((quickEditorVideo as any).hashtags) ? (quickEditorVideo as any).hashtags : [],
      activate: false,
      client_tz: userTimeZone,
      thumbnail_url: (quickEditorVideo as any).thumbnail_url ?? "",
    };

    try {
      const res = await apiServiceDefault.post(`/instagram/schedule/`, draftPayload);
      const data = (res as any)?.data ?? res;
      const newPost: ScheduledPost = {
        ...(new ScheduledPost() as any),
        id: data?.id ?? data?._id ?? `${Date.now()}`,
        reel_id: draftPayload.reel_id,
        profile_id: draftPayload.profile_id,
        scheduled_time: draftPayload.scheduled_time,
        created_time: new Date().toISOString(),
        status: (data?.status as any) || ("draft" as any),
        caption: draftPayload.caption,
        hashtags: draftPayload.hashtags,
        client_tz: draftPayload.client_tz as any,
        ...(draftPayload.thumbnail_url ? ({ thumbnail_url: draftPayload.thumbnail_url } as any) : {}),
      };
      setScheduledPosts((prev) => [...prev, newPost]);
      setQuickEditorPost(newPost);
      return newPost;
    } catch (err: any) {
      const status = err?.response?.status;
      const errText = err?.response?.data?.error || err?.response?.data?.message || err?.message || "";
      const missingReel = status === 404 && /reel not found/i.test(errText || "reel not found");

      if (!missingReel) {
        toast({
          title: "Could not prepare draft",
          description: errText || "Failed to create a draft for this video.",
          variant: "destructive",
        });
        return null;
      }

      try {
        const media_url = (quickEditorVideo as any).video_url || (quickEditorVideo as any).media_url;
        if (!media_url) {
          throw new Error("Missing media URL for upload.");
        }

        await apiServiceDefault.post(`/instagram/upload-reel`, {
          reel_id: reelId,
          media_url,
          caption: (quickEditorVideo as any).caption ?? "",
          thumbnail_url: (quickEditorVideo as any).thumbnail_url ?? "",
          permalink: (quickEditorVideo as any).permalink ?? "",
          timestamp: (quickEditorVideo as any).timestamp ?? new Date().toISOString(),
          like_count: (quickEditorVideo as any).like_count ?? 0,
          comments_count: (quickEditorVideo as any).comments_count ?? 0,
          media_type: "VIDEO",
        });

        const res2 = await apiServiceDefault.post(`/instagram/schedule/`, draftPayload);
        const data2 = (res2 as any)?.data ?? res2;
        const newPost2: ScheduledPost = {
          ...(new ScheduledPost() as any),
          id: data2?.id ?? data2?._id ?? `${Date.now()}`,
          reel_id: draftPayload.reel_id,
          profile_id: draftPayload.profile_id,
          scheduled_time: draftPayload.scheduled_time,
          created_time: new Date().toISOString(),
          status: (data2?.status as any) || ("draft" as any),
          caption: draftPayload.caption,
          hashtags: draftPayload.hashtags,
          client_tz: draftPayload.client_tz as any,
          ...(draftPayload.thumbnail_url ? ({ thumbnail_url: draftPayload.thumbnail_url } as any) : {}),
        };
        setScheduledPosts((prev) => [...prev, newPost2]);
        setQuickEditorPost(newPost2);
        return newPost2;
      } catch (uploadErr: any) {
        const upMsg =
          uploadErr?.response?.data?.error ||
          uploadErr?.response?.data?.message ||
          uploadErr?.message ||
          "Upload failed.";
        toast({
          title: "Could not prepare draft",
          description: upMsg,
          variant: "destructive",
        });
        return null;
      }
    }
  }, [quickEditorVideo, scheduledPosts, selectedProfile, toast]);

  const handleOpenVideoEditor = useCallback(
    (video: VideoItemUi, origin?: DOMRect | ClientRect) => {
      const reelId = video.reel_id || video.id;
      if (!reelId) {
        toast({
          title: "Missing reel reference",
          description: "This video does not have a reel id to attach to a post.",
          variant: "destructive",
        });
        return;
      }

      const existing = selectedProfile?.id
        ? scheduledPosts.find((p) => p.reel_id === reelId && p.profile_id === selectedProfile.id)
        : null;

      setQuickEditorVideo(video);
      setQuickEditorPost(existing ?? null);
      setQuickEditorOrigin(
        origin ? { left: origin.left, top: origin.top, width: origin.width, height: origin.height } : null
      );
      setQuickEditorOpen(true);
    },
    [scheduledPosts, selectedProfile, toast],
  );

  // ---------- Skeleton UI ----------
  if (isBootLoading) {
    return (
      <div className="flex flex-col h-screen">
        {/* Header skeleton */}
        <header className="border-b p-4">
          <div className="mx-auto flex items-center justify-between">
            <Skeleton className="w-28 h-8" />
            <div className="flex items-center gap-3">
              <Skeleton className="w-40 h-10 rounded-full" />
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar skeleton */}
          <div className="w-[320px] border-r flex flex-col">
            <div className="p-4 border-b">
              <div className="flex gap-x-2">
                <Skeleton className="h-10 w-full rounded" />
                <Skeleton className="h-10 w-full rounded" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {/* Media grid placeholder (9 tiles) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full" />
                ))}
              </div>
            </div>
          </div>

          {/* Calendar skeleton */}
          <div className="flex-1 flex flex-col p-6 gap-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <Skeleton className="w-48 h-8" />
              <div className="flex gap-2">
                <Skeleton className="w-24 h-8" />
                <Skeleton className="w-24 h-8" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Real Dashboard ----------
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#F5F0FF] via-[#FAF7FF] to-[#F0EBFF]">
      {/* Global scrollbar styles */}
      <style jsx global>{`
        /* Sidebar scrollbar */
        .dashboard-sidebar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .dashboard-sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .dashboard-sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(124, 126, 244, 0.3);
          border-radius: 3px;
        }
        .dashboard-sidebar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(124, 126, 244, 0.5);
        }
        /* Firefox scrollbar */
        .dashboard-sidebar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(124, 126, 244, 0.3) transparent;
        }

        /* Calendar scrollbar */
        .dashboard-calendar-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .dashboard-calendar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .dashboard-calendar-scroll::-webkit-scrollbar-thumb {
          background: rgba(124, 126, 244, 0.3);
          border-radius: 3px;
        }
        .dashboard-calendar-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(124, 126, 244, 0.5);
        }
        .dashboard-calendar-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(124, 126, 244, 0.3) transparent;
        }
      `}</style>

      {/* Header */}
      <header className="border-b border-[#E7E5F7]/40 bg-white/40 backdrop-blur-sm py-1 px-4">
        <div className="w-full px-4 sm:px-6 lg:px-8 min-[1921px]:px-0 flex items-center justify-between">
          <div className="text-blue-500 font-bold text-lg">
            <img src="/logo.png" alt="Publefy Logo" className="w-28" />
          </div>

          <ProfileSelector
            availableProfiles={availableProfiles}
            selectedProfile={selectedProfile}
            onProfileSelect={(p) => {
              setSelectedProfile(p);
              if (p?.id) localStorage.setItem("selectedProfileId", p.id);
              else localStorage.removeItem("selectedProfileId");
              if (p?.ig_id) localStorage.setItem("selectedProfileIgId", p.ig_id);
              else localStorage.removeItem("selectedProfileIgId");
              // Fire event so MediaGrid updates immediately (same-tab)
              if (typeof window !== "undefined") {
                if (p) {
                  window.dispatchEvent(
                    new CustomEvent("ig:selected", { detail: { igId: p.ig_id, profileId: p.id, profile: p } })
                  );
                } else {
                  window.dispatchEvent(new CustomEvent("ig:cleared"));
                }
              }
            }}
            reloadProfiles={fetchProfiles}
            highlight={coachmarkAddAccount && !selectedProfile}
          />
        </div>
      </header>

      {/* Mobile Tabs */}
      <div className="block md:hidden border-b border-[#E7E5F7]/40 bg-white/40 backdrop-blur-sm">
        <div
          role="tablist"
          className="flex items-center gap-2 px-4 py-2"
          aria-label="Dashboard tabs"
        >
          <button
            role="tab"
            aria-selected={mobileTab === "media"}
            aria-controls="mobile-media-panel"
            id="mobile-media-tab"
            onClick={() => setMobileTab("media")}
            className={cn(
              "flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[#7C7EF4]/20 focus:ring-offset-2",
              mobileTab === "media"
                ? "bg-[#301B69] text-white shadow-sm"
                : "bg-white/30 text-[#301B69] hover:bg-white/40"
            )}
          >
            Media
          </button>
          <button
            role="tab"
            aria-selected={mobileTab === "calendar"}
            aria-controls="mobile-calendar-panel"
            id="mobile-calendar-tab"
            onClick={() => setMobileTab("calendar")}
            className={cn(
              "flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[#7C7EF4]/20 focus:ring-offset-2",
              mobileTab === "calendar"
                ? "bg-[#301B69] text-white shadow-sm"
                : "bg-white/30 text-[#301B69] hover:bg-white/40"
            )}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Desktop Body - Hidden on mobile */}
      <div className="hidden md:flex flex-1 overflow-hidden gap-4 p-4">
        {/* Sidebar */}
        <div className="w-[320px] flex flex-col rounded-[22px] border border-white/40 bg-white/60 backdrop-blur-sm shadow-[0_10px_30px_rgba(27,13,63,0.08)] overflow-hidden">
          <div className="p-4 border-b border-[#E7E5F7]/40">
            <div className="flex flex-col gap-2">
              <Button
                className={cn(
                  "w-full rounded-full h-10 text-sm font-semibold text-white",
                  "bg-gradient-to-b from-[#7C7EF4] to-[#6F80F0]",
                  "shadow-[0_8px_24px_rgba(91,12,213,0.20),inset_0_8px_10px_rgba(255,255,255,0.22)]",
                  prefersReducedMotion
                    ? ""
                    : "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(91,12,213,0.25)] active:scale-[0.99]"
                )}
                onClick={() => {
                  setCoachmarkAddAccount(false);
                  setVideoProcessorOpen(true);
                }}
              >
                Generate Memes
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "w-full rounded-full h-10 text-sm font-semibold",
                  "border-[#E7E5F7] text-[#301B69] hover:bg-[#7C7EF4]/10",
                  prefersReducedMotion
                    ? ""
                    : "transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
                )}
                onClick={() => {
                  setCoachmarkAddAccount(false);
                  setVideoUploadOpen(true);
                }}
              >
                Upload Video
              </Button>
            </div>
          </div>

          {/* Media grid area */}
          <div className="flex-1 overflow-y-auto p-2 dashboard-sidebar-scroll">
            <MediaGrid
              items={mediaItems}
              setItems={setMediaItems}
              igId={selectedProfile?.ig_id}
              onVideoSelect={handleOpenVideoEditor}
            />
          </div>

          {/* Sidebar Bottom Section */}
          <div className="p-3 border-t border-[#E7E5F7]/40 space-y-1">
            {/* Points Usage Bar */}
            {user?.subscription?.has_unlimited_promo ? (
              <div className="px-3 py-2 mb-2 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-[#301B69]/60 uppercase tracking-tight">Credits</span>
                  <span className="text-[11px] font-semibold text-[#301B69]">UNLIMITED</span>
                </div>
                <div className="h-1.5 w-full bg-[#E7E5F7] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#7C7EF4] to-[#6F80F0]" style={{ width: '100%' }} />
                </div>
              </div>
            ) : usage.points_total_limit > 0 ? (
              <div className="px-3 py-2 mb-2 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] font-bold text-[#301B69]/60 uppercase tracking-tight">Credits</span>
                  <span className="text-[11px] font-semibold text-[#301B69]">{usage.points_balance} / {usage.points_total_limit}</span>
                </div>
                <div className="h-1.5 w-full bg-[#E7E5F7] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-[#7C7EF4] to-[#6F80F0] transition-all duration-1000" 
                    style={{ width: `${Math.min(100, (usage.points_balance / usage.points_total_limit) * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            <button
              onClick={() => router.push("/account")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[#301B69] hover:bg-[#7C7EF4]/10 transition-colors group"
            >
              <Settings className="w-[18px] h-[18px] text-[#5A5192] group-hover:text-[#7C7EF4]" />
              <span className="text-sm font-medium">Settings</span>
            </button>
            <a
              href="https://discord.gg/PYVjRmRA"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[#301B69] hover:bg-[#7C7EF4]/10 transition-colors group no-underline"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 fill-[#5A5192] group-hover:fill-[#7C7EF4] transition-colors"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.077 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.074 0 01.0785.0095c.1202.099.246.1971.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
              </svg>
              <span className="text-sm font-medium">Discord</span>
            </a>
          </div>
        </div>

        {/* Calendar View */}
        <div className="flex-1 flex flex-col overflow-hidden rounded-[22px] border border-white/40 bg-white/60 backdrop-blur-sm shadow-[0_10px_30px_rgba(27,13,63,0.08)] min-w-0">
          {loadingPosts && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-[#5A5192] border-b border-[#E7E5F7]/60 bg-white/50">
              <div className="h-3 w-3 rounded-full border-2 border-[#7C7EF4]/40 border-b-[#7C7EF4] animate-spin" />
              <span>Loading posts...</span>
            </div>
          )}
          <div className="flex-1 min-w-0 min-h-0 w-full h-full">
          <CalendarView
            currentDate={currentDate}
            profile={selectedProfile}
            videoItems={mediaItems}
            scheduledPosts={selectedProfile ? scheduledPosts.filter((x) => x.profile_id === selectedProfile.id) : []}
            onDateChange={handleDateChange}
            weekStartsOn={1}  // Monday
            startHour={0}     // 00:00
            endHour={24}      // 24:00
            onPostUpdate={handlePostUpdate}
            onPostDelete={handlePostDelete}
          />
          </div>
        </div>
      </div>

      {/* Mobile Body - Visible on mobile only */}
      <div className="block md:hidden flex-1 overflow-hidden">
        {/* Calendar Tab */}
        <div
          role="tabpanel"
          id="mobile-calendar-panel"
          aria-labelledby="mobile-calendar-tab"
          className={cn(
            "h-full flex flex-col",
            mobileTab !== "calendar" && "hidden"
          )}
        >
          <div className="flex-1 flex flex-col overflow-hidden rounded-[22px] border border-white/40 bg-white/60 backdrop-blur-sm shadow-[0_10px_30px_rgba(27,13,63,0.08)] m-2">
            {loadingPosts && (
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-[#5A5192] border-b border-[#E7E5F7]/60 bg-white/50">
                <div className="h-3 w-3 rounded-full border-2 border-[#7C7EF4]/40 border-b-[#7C7EF4] animate-spin" />
                <span>Loading posts...</span>
              </div>
            )}
            <CalendarView
              currentDate={currentDate}
              profile={selectedProfile}
              videoItems={mediaItems}
              scheduledPosts={selectedProfile ? scheduledPosts.filter((x) => x.profile_id === selectedProfile.id) : []}
              onDateChange={handleDateChange}
              weekStartsOn={1}
              startHour={0}
              endHour={24}
              onPostUpdate={handlePostUpdate}
              onPostDelete={handlePostDelete}
            />
          </div>
        </div>

        {/* Media Tab */}
        <div
          role="tabpanel"
          id="mobile-media-panel"
          aria-labelledby="mobile-media-tab"
          className={cn(
            "h-full flex flex-col",
            mobileTab !== "media" && "hidden"
          )}
        >
          <div className="flex-1 flex flex-col overflow-hidden rounded-[22px] border border-white/40 bg-white/60 backdrop-blur-sm shadow-[0_10px_30px_rgba(27,13,63,0.08)] m-2">
            {/* Create Post Button - Sticky at top */}
            <div className="sticky top-0 z-10 p-4 border-b border-[#E7E5F7]/40 bg-white/60 backdrop-blur-sm">
              <div className="flex flex-col gap-2">
                <Button
                  className={cn(
                    "w-full rounded-full h-11 text-sm font-semibold text-white",
                    "bg-gradient-to-b from-[#7C7EF4] to-[#6F80F0]",
                    "shadow-[0_8px_24px_rgba(91,12,213,0.20),inset_0_8px_10px_rgba(255,255,255,0.22)]",
                    prefersReducedMotion
                      ? ""
                      : "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(91,12,213,0.25)] active:scale-[0.99]"
                  )}
                  onClick={() => {
                    setCoachmarkAddAccount(false);
                    setVideoProcessorOpen(true);
                  }}
                >
                  Generate Memes
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full rounded-full h-11 text-sm font-semibold",
                    "border-[#E7E5F7] text-[#301B69] hover:bg-[#7C7EF4]/10",
                    prefersReducedMotion
                      ? ""
                      : "transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99]"
                  )}
                  onClick={() => {
                    setCoachmarkAddAccount(false);
                    setVideoUploadOpen(true);
                  }}
                >
                  Upload Video
                </Button>
              </div>
            </div>

            {/* Media grid area */}
            <div className="flex-1 overflow-y-auto p-3 dashboard-sidebar-scroll">
              <MediaGrid
                items={mediaItems}
                setItems={setMediaItems}
                igId={selectedProfile?.ig_id}
                onVideoSelect={handleOpenVideoEditor}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inline editor for media grid selections */}
      {quickEditorVideo && (
        <PostEditor
          open={quickEditorOpen}
          onOpenChange={(open) => {
            setQuickEditorOpen(open);
            if (!open) {
              setQuickEditorPost(null);
              setQuickEditorVideo(null);
              setQuickEditorOrigin(null);
            }
          }}
          originRect={quickEditorOrigin}
          post={quickEditorPost}
          video={quickEditorVideo}
          selectedProfile={selectedProfile}
          onUpdate={(post) => {
            setQuickEditorPost(post);
            handlePostUpdate(post);
          }}
          onDelete={(postId) => {
            handlePostDelete(postId);
            setQuickEditorOpen(false);
            setQuickEditorPost(null);
            setQuickEditorVideo(null);
            setQuickEditorOrigin(null);
          }}
          onEnsurePost={ensureQuickEditorPost}
          onRequireProfile={() => {
            setCoachmarkMessage("Connect an Instagram account to enable scheduling features.");
            setCoachmarkAddAccount(true);
          }}
        />
      )}

      {/* Modals */}
      <VideoProcessorModal
        open={videoProcessorOpen}
        profile={selectedProfile}
        onOpenChange={setVideoProcessorOpen}
        onVideoGenerated={handleNewVideoGenerated}
        onUsageUpdate={fetchUsage}
        initialFile={(() => {
          try {
            if (typeof window === "undefined") return undefined;
            const resume: any = (window as any).__videoProcessorResume;
            return resume?.file as File | undefined;
          } catch { return undefined; }
        })()}
        initialAnalysis={(() => {
          try {
            if (typeof window === "undefined") return undefined;
            const raw = sessionStorage.getItem("resumeVideoProcessorState");
            const state = raw ? JSON.parse(raw) : null;
            if (state && state.videoSummary && Array.isArray(state.memeOptions)) {
              return {
                videoSummary: state.videoSummary,
                memeOptions: state.memeOptions,
                selectedMemeOption: state.selectedMemeOption,
              };
            }
          } catch { }
          return undefined;
        })()}
      />

      <VideoUploadModal
        open={videoUploadOpen}
        onOpenChange={setVideoUploadOpen}
        profile={selectedProfile}
        onVideoGenerated={handleNewVideoGenerated}
      />

      {/* Coachmark: guide user to add account (top-right) */}
      {coachmarkAddAccount && !selectedProfile && (
        <div className="fixed inset-0 z-[9999]">
          {/* Dark translucent backdrop */}
          <div className="absolute inset-0 bg-black/70" />
          {/* Arrow + card above backdrop */}
          <div className="absolute top-[100px] right-[200px] flex items-start gap-2 z-[10000]">
            <div className="bg-white shadow-lg rounded-md p-3 max-w-xs text-sm border border-blue-200">
              <div className="font-medium mb-1 text-blue-700">Add an account</div>
              <div className="text-gray-700">
                {coachmarkMessage || "Select or add an account here to continue creating your post."}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => {
                    try { window.dispatchEvent(new CustomEvent("profileSelector:open")); } catch { }
                    setCoachmarkAddAccount(false);
                  }}
                >
                  Open selector
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setCoachmarkAddAccount(false)}>Got it</Button>
              </div>
            </div>
            <ArrowUpRight className="w-8 h-8 text-blue-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]" />
          </div>
        </div>
      )}

      {/* Better on Desktop modal - shows on mobile after login */}
      <BetterOnDesktopModal />
    </div>
  );
}
