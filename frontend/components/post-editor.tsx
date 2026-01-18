"use client"

import React, { useMemo, useState, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Film, Hash, X, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AuthAvatarImage } from "@/components/profile-selector"
import { Badge } from "@/components/ui/badge"
import type { ScheduledPost } from "@/types/scheduled-post"
import type { Profile } from "@/types/profile"
import { apiServiceDefault } from "@/services/api/api-service"
import type { VideoItemUi } from "@/types/video-item"
import { API_BASE, CLOUD_RUN_BASE, MEDIA_BASE } from "@/services/api/apiConfig"
import { getAuthToken } from "@/utils/getAuthToken"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DateTimePicker } from "@/components/ui/date-time-picker"

type Rect = { left: number; top: number; width: number; height: number }

function toApiMediaUrl(raw?: string | null): string {
  if (!raw) return ""
  const normalized = normalizeRawUrl(raw)
  const mediaBase = (MEDIA_BASE || API_BASE || CLOUD_RUN_BASE || "").replace(/\/+$/, "")

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized)
      const host = url.hostname.toLowerCase()
      if (mediaBase && (host === "publefy.com" || host === "www.publefy.com" || host === "publefy.vercel.app" || host === "www.publefy.vercel.app")) {
        const cleanPath = url.pathname.replace(/^\/+/, "")
        return `${mediaBase}/${cleanPath}${url.search || ""}`
      }
    } catch {
      // ignore parse errors and fall through
    }
    return normalized
  }

  const trimmed = normalized.replace(/^\/+/, "")

  if (trimmed.startsWith("memes/media/")) {
    return mediaBase ? `${mediaBase}/${trimmed}` : `/${trimmed}`
  }

  const needsProxy = ["instagram_reels/", "bank-mem/", "processed_videos/", "users/"].some((p) =>
    trimmed.startsWith(p),
  )
  if (needsProxy) {
    const encoded = trimmed
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")
    return mediaBase ? `${mediaBase}/memes/media/${encoded}` : `/memes/media/${encoded}`
  }

  const apiBase = API_BASE.replace(/\/+$/, "")
  return apiBase ? `${apiBase}/${trimmed}` : `/${trimmed}`
}

function normalizeRawUrl(value?: string | null): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      url.pathname = url.pathname
        .split("/")
        .map((part) => encodeURIComponent(decodeURIComponent(part)))
        .join("/")
      return url.toString()
    } catch {
      return trimmed.replace(/ /g, "%20")
    }
  }
  return trimmed
}

function getOrigin(value?: string): string {
  if (!value) return ""
  try {
    return new URL(value).origin
  } catch {
    const trimmed = value.trim()
    const match = trimmed.match(/^https?:\/\/([^/]+)/i)
    return match ? match[0].replace(/\/$/, "") : ""
  }
}

function shouldAttachAuth(url: string): boolean {
  const targetOrigin = getOrigin(url)
  if (!targetOrigin) return false
  const origins = new Set(
    [API_BASE, MEDIA_BASE, CLOUD_RUN_BASE, typeof window !== "undefined" ? window.location.origin : undefined]
      .map(getOrigin)
      .filter((value): value is string => !!value),
  )
  return origins.has(targetOrigin)
}

async function fetchAsObjectURL(url: string): Promise<string> {
  const headers: Record<string, string> = {}
  const init: RequestInit = { mode: "cors" }
  if (shouldAttachAuth(url)) {
    const token = getAuthToken()
    if (token) headers.Authorization = `Bearer ${token}`
    init.credentials = "include"
  }
  const res = await fetch(url, { ...init, headers, cache: "no-store" })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

type CachedVideo = { src: string; isObjectUrl: boolean }
const videoSrcCache = new Map<string, CachedVideo>()
const videoSrcInflight = new Map<string, Promise<CachedVideo>>()

async function resolveVideoSrc(url: string): Promise<CachedVideo> {
  if (!shouldAttachAuth(url)) {
    return { src: url, isObjectUrl: false }
  }

  const cached = videoSrcCache.get(url)
  if (cached) return cached

  const inflight = videoSrcInflight.get(url)
  if (inflight) return inflight

  const promise = (async () => {
    const objUrl = await fetchAsObjectURL(url)
    const entry: CachedVideo = { src: objUrl, isObjectUrl: true }
    videoSrcCache.set(url, entry)
    return entry
  })()

  videoSrcInflight.set(url, promise)
  return promise.finally(() => {
    videoSrcInflight.delete(url)
  })
}

interface PostEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: ScheduledPost | null
  video: VideoItemUi | null
  selectedProfile: Profile | null
  isOld?: boolean
  onUpdate?: (post: ScheduledPost) => void
  onDelete?: (postId: string) => void
  originRect?: Rect | null // 👈 NEW
  onEnsurePost?: () => Promise<ScheduledPost | null>
  onRequireProfile?: () => void
}

export default function PostEditor({
  open,
  onOpenChange,
  post,
  video,
  selectedProfile,
  isOld = false,
  onUpdate,
  onDelete,
  originRect,
  onEnsurePost,
  onRequireProfile,
}: PostEditorProps) {
  const [livePost, setLivePost] = useState<ScheduledPost | null>(post)
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [loadingVideo, setLoadingVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [caption, setCaption] = useState("")
  const [hashtags, setHashtags] = useState<string[]>([])
  const [newHashtag, setNewHashtag] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [candidateIndex, setCandidateIndex] = useState(0)
  const lastSyncedPostId = useRef<string | null>(null)

  const [scheduledDate, setScheduledDate] = useState<Date>()
  const [dateChanged, setDateChanged] = useState(false)
  const [mounted, setMounted] = useState(false)
  const status = (livePost as any)?.status?.toString?.().toLowerCase?.() || ""
  const isDraft = status === "draft"
  const isPublishedLike = ["published", "success", "live", "posted", "completed"].includes(status)
  const hasPermalink = Boolean((livePost as any)?.permalink_url)
  const isOldView = Boolean(isOld || isPublishedLike || hasPermalink)
  const deleteButtonLabel = deleting ? "Removing..." : isOldView ? "Delete from Instagram" : "Delete Post"
  const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Prevent body scrolling when dialog is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  useEffect(() => {
    setMounted(true)
  }, [])

  const memoizedScheduledDate = useMemo(() => {
    if (!livePost || !livePost.scheduled_time) return null
    return new Date(livePost.scheduled_time)
  }, [livePost?.scheduled_time])

  // keep local state in sync
  useEffect(() => {
    setLivePost(post)
  }, [post])

  // Load post data when post changes
  useEffect(() => {
    if (livePost === null) {
      lastSyncedPostId.current = null
      return
    }

    // Only sync if it's a different post or wasn't synced yet
    if (livePost.id !== lastSyncedPostId.current) {
      setCaption(livePost.caption || "")
      setHashtags(livePost.hashtags || [])

      // Sync date ONLY when the post changes
      if (memoizedScheduledDate) {
        setScheduledDate(memoizedScheduledDate)
        setDateChanged(false)
      }

      lastSyncedPostId.current = livePost.id
    }
  }, [livePost, memoizedScheduledDate])

  useEffect(() => {
    if (isOldView) {
      setShowDeleteDialog(false)
    }
  }, [isOldView])

  if (!livePost && !video) {
    // Keep AnimatePresence mounted; nothing to show
  }

  // Build a prioritized list of possible video URLs (proxy-friendly first)
  const videoCandidates = useMemo(() => {
    const raw: string[] = []
    const derived: string[] = []
    const add = (val?: unknown) => {
      if (typeof val !== "string" || !val.trim()) return
      const normalized = normalizeRawUrl(val)
      if (!normalized) return
      const downloadMatch = normalized.match(/\/video\/download\/(.+)/i)
      if (downloadMatch?.[1]) {
        derived.push(downloadMatch[1]) // try proxy path instead of download endpoint
        return // never keep the download URL itself
      }
      raw.push(normalized)
    }

    add((video as any)?.final_video_path)
    add((video as any)?.video_path)
    add((video as any)?.original_video_path)
    add(video?.video_url)
    add((video as any)?.final_video_url)
    add((video as any)?.media_url)
    add((video as any)?.url)

    // If we see a /video/download/ URL, also try the raw path via /memes/media/
    raw.forEach((val) => {
      const match = val.match(/\/video\/download\/(.+)/i)
      if (match?.[1]) {
        // Prefer proxyable path first
        derived.push(match[1])
      }
    })

    const prioritized = [...derived, ...raw]

    return Array.from(
      new Set(
        prioritized
          .map((v) => toApiMediaUrl(v))
          .filter((v): v is string => !!v),
      ),
    )
  }, [video])

  // Reset candidate index when the video changes
  useEffect(() => {
    setCandidateIndex(0)
  }, [videoCandidates])

  // Resolve authenticated video URL for preview with fallbacks
  useEffect(() => {
    const currentUrl = videoCandidates[candidateIndex]

    if (!currentUrl) {
      setVideoSrc(null)
      setVideoError(null)
      return
    }
    let cancelled = false
    let revoke: string | null = null

    const load = async () => {
      setLoadingVideo(true)
      setVideoError(null)
      try {
        const resolved = await resolveVideoSrc(currentUrl)
        if (cancelled) return
        revoke = resolved.isObjectUrl ? resolved.src : null
        setVideoSrc(resolved.src)
      } catch (err: any) {
        if (cancelled) return
        const hasNext = candidateIndex < videoCandidates.length - 1
        if (hasNext) {
          setCandidateIndex((idx) => idx + 1)
          return
        }
        setVideoError(err?.message || "Failed to load video")
        setVideoSrc(null)
      } finally {
        if (!cancelled) {
          setLoadingVideo(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
      // do not revoke cached URLs; only revoke a transient one if we fetched and didn't cache
      if (revoke && !videoSrcCache.has(currentUrl)) URL.revokeObjectURL(revoke)
    }
  }, [videoCandidates, candidateIndex])

  const handleVideoElementError = () => {
    if (candidateIndex < videoCandidates.length - 1) {
      setCandidateIndex((idx) => idx + 1)
      setVideoError(null)
      return
    }
    setVideoError("Failed to load video")
  }

  const finalCaption = `${caption}\n\n${hashtags.map((tag) => `#${tag}`).join(" ")}`
  const publishMediaUrl = useMemo(
    () => videoCandidates.find((u) => /^https?:\/\//i.test(u)) || "",
    [videoCandidates],
  )

  const addHashtag = () => {
    const newTags = newHashtag
      .trim()
      .split(/\s+/)
      .map((tag) => tag.replace(/^#/, ""))
      .filter(Boolean)

    if (newTags.length > 0) {
      setHashtags((prev) => [...new Set([...prev, ...newTags])])
      setNewHashtag("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addHashtag()
    }
  }

  const handleDateChange = (date: Date) => {
    setScheduledDate(date)
    setDateChanged(true)
  }

  const ensurePost = useCallback(async (): Promise<ScheduledPost | null> => {
    const isTempId = (id?: string) => !id || id.startsWith("temp-") || /^\d{13,}$/.test(id)
    if (livePost?.id && !isTempId(livePost.id) && livePost.profile_id) return livePost
    if (!onEnsurePost) {
      setMessage({ type: "error", text: "No draft exists yet. Cannot continue." })
      return null
    }
    try {
      const created = await onEnsurePost()
      if (created) {
        setLivePost(created)
        if (created.scheduled_time) {
          setScheduledDate(new Date(created.scheduled_time as any))
        }
      }
      return created ?? null
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Could not prepare the post." })
      return null
    }
  }, [livePost, onEnsurePost])

  // Publish now
  const handlePublishNow = async () => {
    if (publishing || scheduling) return
    if (!selectedProfile) {
      onRequireProfile?.()
      return
    }

    setPublishing(true)
    setMessage(null)

    try {
      const readyPost = await ensurePost()
      if (!readyPost || !readyPost.id || !readyPost.profile_id) {
        setMessage({ type: "error", text: "Missing post or profile." })
        setPublishing(false) // Reset if we bail early
        return
      }

      const reelId = readyPost.reel_id || (video as any)?.reel_id || video?.id || ""
      const profileId = readyPost.profile_id || selectedProfile?.id || ""
      const igId = (selectedProfile as any)?.ig_id || ""

      const existingDate =
        scheduledDate ??
        (readyPost.scheduled_time instanceof Date ? readyPost.scheduled_time : new Date(readyPost.scheduled_time))

      if (existingDate && !isNaN(existingDate.getTime())) {
        await apiServiceDefault.patch(`/instagram/scheduled-posts/${readyPost.id}`, {
          caption: finalCaption,
          hashtags,
          scheduled_time: existingDate.toISOString(),
          client_tz: clientTz,
          reel_id: reelId,
          profile_id: profileId,
          ig_id: igId || undefined,
          media_url: publishMediaUrl || undefined,
        })
      }

      const resp = await apiServiceDefault.post<any>("/instagram/publish/", {
        post_id: readyPost.id,
        publish_now: true,
        move_schedule_to_now: true,
        client_tz: clientTz,
        reel_id: reelId || undefined,
        profile_id: profileId || undefined,
        ig_id: igId || undefined,
        media_url: publishMediaUrl || undefined,
      })

      const data = resp?.data ?? resp
      if (data?.success) {
        const nowIso = new Date().toISOString()
        const updatedPost = {
          ...readyPost,
          caption: finalCaption,
          hashtags,
          scheduled_time: nowIso as any,
        }
        setLivePost(updatedPost)
        onUpdate?.(updatedPost as ScheduledPost)
        setMessage({ type: "success", text: "Published successfully!" })
        setTimeout(() => onOpenChange(false), 1200)
        return
      }

      const statusCode = data?.details?.status_code
      const containerId = data?.details?.id
      const msg =
        data?.publish_result?.error?.error_user_msg ||
        data?.publish_result?.error ||
        data?.message ||
        data?.error ||
        "Publishing failed."

      const suffix =
        statusCode || containerId
          ? ` (IG: ${statusCode ?? "ERROR"}${containerId ? ` • container ${containerId}` : ""})`
          : ""

      setMessage({ type: "error", text: `${msg}${suffix}` })
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.publish_result?.error?.error_user_msg ||
        err?.response?.data?.publish_result?.error ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Unexpected error occurred."
      setMessage({ type: "error", text: serverMsg })
    } finally {
      setPublishing(false)
    }
  }

  // Delete the post
  const handleDeletePost = async () => {
    if (deleting) return
    if (!livePost) {
      onOpenChange(false)
      setShowDeleteDialog(false)
      return
    }

    const targetId = livePost.id || (livePost as any)?._id
    if (!targetId) {
      setMessage({ type: "error", text: "Missing post id. Unable to delete." })
      return
    }

    setDeleting(true)
    setMessage(null)
    try {
      const deleteUrl = selectedProfile?.id
        ? `/instagram/scheduled-posts/${targetId}?profile_id=${encodeURIComponent(selectedProfile.id)}`
        : `/instagram/scheduled-posts/${targetId}`

      const response = await apiServiceDefault.delete<any>(deleteUrl)
      const status = typeof response?.status === "number" ? response.status : 200
      const payload = (response as any)?.data ?? response
      const isOk = status >= 200 && status < 300

      if (!isOk) {
        setMessage({
          type: "error",
          text: payload?.error || payload?.message || (payload as any)?.data || "Failed to delete post.",
        })
        return
      }

      onDelete?.(String(targetId))
      setLivePost(null)
      setShowDeleteDialog(false)
      onOpenChange(false)
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Unexpected error occurred."
      setMessage({ type: "error", text: serverMsg })
    } finally {
      setDeleting(false)
    }
  }

  // Schedule / Reschedule
  const handleSchedulePost = async () => {
    if (scheduling || publishing) return
    if (!selectedProfile) {
      onRequireProfile?.()
      return
    }
    if (!scheduledDate) {
      setMessage({ type: "error", text: "Pick a date & time first." })
      return
    }

    setScheduling(true)
    setMessage(null)

    try {
      const readyPost = await ensurePost()
      if (!readyPost) {
        setScheduling(false) // Reset if we bail early
        return
      }
      if (!readyPost.profile_id) {
        setMessage({ type: "error", text: "Profile is required." })
        setScheduling(false) // Reset if we bail early
        return
      }
      const reelId = readyPost.reel_id || (video as any)?.reel_id || video?.id || ""
      const profileId = readyPost.profile_id || selectedProfile?.id || ""
      const igId = (selectedProfile as any)?.ig_id || ""

      const payload: any = {
        id: readyPost.id,
        caption: finalCaption,
        hashtags,
        scheduled_time: scheduledDate.toISOString(),
        client_tz: clientTz,
        reel_id: reelId,
        profile_id: profileId,
        ig_id: igId || undefined,
      }

      if (isDraft) {
        payload.activate = true
      }

      const raw = await apiServiceDefault.patch(`/instagram/scheduled-posts/${readyPost.id}`, payload)

      const httpStatus: number = typeof (raw as any)?.status === "number" ? (raw as any).status : 200
      const data: any = (raw as any)?.data ?? raw

      const apiStatus = (data?.status ?? "").toString().toLowerCase()
      const apiSuccess = Boolean(data?.success)
      const isOkHttp = httpStatus === 200 || httpStatus === 201
      const isOkApi = apiSuccess || ["rescheduled", "scheduled", "ok", "success", "draft"].includes(apiStatus)

      if (isOkHttp && isOkApi) {
        const becameStatus = apiStatus || (isDraft ? "scheduled" : "scheduled")

        setMessage({
          type: "success",
          text: isDraft ? "Schedule activated!" : "Post rescheduled successfully!",
        })

        const updatedPost = {
          ...readyPost,
          caption: payload.caption,
          hashtags: payload.hashtags,
          scheduled_time: scheduledDate, // keep Date for your class
          ...(becameStatus ? ({ status: becameStatus } as any) : {}),
        } as ScheduledPost

        setLivePost(updatedPost)
        onUpdate?.(updatedPost)

        setTimeout(() => onOpenChange(false), 1200)
      } else {
        const serverMsg = data?.message || data?.error || data?.publish_result?.error_user_msg || "Failed to schedule post."
        setMessage({ type: "error", text: serverMsg })
      }
    } catch (err: any) {
      const serverMsg =
        err?.response?.data?.message || err?.response?.data?.error || err?.message || "Unexpected error occurred."
      setMessage({ type: "error", text: serverMsg })
    } finally {
      setScheduling(false)
    }
  }

  // Sizing for animation target
  const targetSize =
    typeof window !== "undefined" ? Math.min(1200, window.innerWidth - 32, window.innerHeight * 0.9) : 1200

  const editorContent = (
    <AnimatePresence>
      {open && (livePost || video) && (
        <>
          {/* Overlay */}
          <motion.div
            key="overlay"
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Animated Panel Wrapper / Scroll Container for Mobile */}
          <div
            className="fixed inset-0 z-50 overflow-y-auto flex items-start sm:items-center justify-center p-4 py-8 sm:p-0"
            onClick={() => onOpenChange(false)}
          >
            <motion.div
              key="panel"
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-lg shadow-lg w-full md:max-h-[90vh] flex flex-col relative"
              style={{ overflow: "hidden" }}
              initial={
                originRect
                  ? {
                    opacity: 1,
                    borderRadius: 12,
                  }
                  : {
                    scale: 0.95,
                    opacity: 0,
                  }
              }
              animate={{
                width: targetSize,
                height: targetSize,
                opacity: 1,
                borderRadius: 16,
                transition: { type: "spring", stiffness: 220, damping: 22 },
              }}
              exit={
                originRect
                  ? {
                    opacity: 0.8,
                    borderRadius: 12,
                    transition: { duration: 0.18 },
                  }
                  : { scale: 0.95, opacity: 0, transition: { duration: 0.18 } }
              }
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b bg-white/50 backdrop-blur-sm sticky top-0 z-20 gap-3">
                <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <div className="relative shrink-0">
                    <Avatar className="h-9 w-9 sm:h-10 sm:w-10 border-2 border-primary/10 shadow-sm">
                      <AuthAvatarImage
                        profile={selectedProfile}
                        alt={selectedProfile?.username || selectedProfile?.name || "profile"}
                        className="h-9 w-9 sm:h-10 sm:w-10"
                      />
                      <AvatarFallback className="bg-primary/5 text-primary text-xs sm:text-sm">
                        {selectedProfile?.name?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 flex items-center justify-center bg-pink-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 text-[8px] sm:text-[10px] border-2 border-white shadow-sm font-bold">
                      IG
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs sm:text-sm text-slate-900 truncate">@{selectedProfile?.name || "Unknown"}</div>
                    <div className="text-[9px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:block">
                      Instagram Reel
                    </div>
                  </div>
                  <div className="ml-auto sm:hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onOpenChange(false)}
                      className="h-8 w-8 rounded-full hover:bg-slate-100/50"
                    >
                      <X className="h-4 w-4 text-slate-500" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto sm:overflow-visible">
                  <div className="flex-1 sm:flex-initial">
                    <DateTimePicker
                      date={scheduledDate ?? null}
                      setDate={handleDateChange}
                    />
                  </div>
                  <div className="hidden sm:block">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onOpenChange(false)}
                      className="rounded-full hover:bg-slate-100/50"
                    >
                      <X className="h-5 w-5 text-slate-500" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Content Body: 2-column on desktop, stacked on mobile */}
              <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">

                {/* Left Column: Media Preview */}
                <div className="w-full md:w-[52%] lg:w-[48%] xl:w-1/2 bg-slate-950 flex flex-col items-center justify-center relative border-r border-slate-200/10 min-h-[220px] sm:min-h-[300px] md:min-h-0 overflow-hidden">
                  {video && videoCandidates.length ? (
                    loadingVideo ? (
                      <div className="space-y-4 flex flex-col items-center">
                        <Loader2 className="w-8 h-8 text-primary/60 animate-spin" />
                        <span className="text-white/40 text-sm font-medium">Preparing preview...</span>
                      </div>
                    ) : videoError ? (
                      <div className="px-6 text-center space-y-2">
                        <Film className="w-10 h-10 text-white/20 mx-auto" />
                        <p className="text-white/60 text-sm">{videoError}</p>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <video
                          src={videoSrc ?? undefined}
                          className="w-full h-full object-contain"
                          autoPlay
                          muted
                          loop
                          playsInline
                          controls
                          onError={handleVideoElementError}
                        />
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Film className="w-12 h-12 text-white/10" />
                      <p className="text-white/30 text-sm uppercase tracking-widest font-bold">No Preview</p>
                    </div>
                  )}

                  {/* Visual indicator for "Reel" format */}
                  <div className="absolute top-4 left-4 z-10">
                    <Badge className="bg-black/40 backdrop-blur-md border border-white/10 text-[10px] py-0 px-2 font-semibold">
                      9:16 REEL
                    </Badge>
                  </div>
                </div>

                {/* Right Column: Editor Controls */}
                <div className="flex-1 md:overflow-y-auto bg-slate-50/30">
                  <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

                    {/* Caption Editor */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest px-1">
                        Caption
                      </label>
                      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                        <Textarea
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder="Share something interesting..."
                          className="min-h-[120px] sm:min-h-[160px] bg-transparent border-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-3 sm:p-4 text-sm sm:text-[15px] leading-relaxed"
                        />
                      </div>
                    </div>

                    {/* Hashtags Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                          <Hash className="h-3.5 w-3.5" />
                          Hashtags
                        </div>
                        <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {hashtags.length} added
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 min-h-[40px]">
                        <AnimatePresence mode="popLayout">
                          {hashtags.map((tag, index) => (
                            <motion.div
                              key={tag + index}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.8, opacity: 0 }}
                            >
                              <Badge
                                variant="secondary"
                                className="group flex items-center gap-1.5 py-1.5 px-3 bg-white border border-slate-200 hover:border-primary/30 rounded-xl transition-all shadow-sm"
                              >
                                <span className="text-primary font-bold text-xs">#</span>
                                <span className="text-slate-700 font-medium text-xs">{tag}</span>
                                <button
                                  onClick={() => setHashtags(hashtags.filter((_, i) => i !== index))}
                                  className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </Badge>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      <div className="flex gap-2">
                        <div className="relative flex-1 group">
                          <Input
                            placeholder="Add hashtag"
                            className="h-11 rounded-xl bg-white border-slate-200 pl-4 pr-10 focus:ring-primary/20 transition-all text-sm"
                            value={newHashtag}
                            onChange={(e) => setNewHashtag(e.target.value)}
                            onKeyDown={handleKeyDown}
                          />
                          <Hash className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-focus-within:text-primary transition-colors" />
                        </div>
                        <Button
                          variant="secondary"
                          onClick={addHashtag}
                          className="h-11 px-6 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-semibold text-sm shadow-sm"
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    {/* Message Display inside the scrollable area for visibility */}
                    {message && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-3 ${message.type === "success"
                          ? "bg-green-50 border-green-100 text-green-700"
                          : "bg-red-50 border-red-100 text-red-700"
                          }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${message.type === "success" ? "bg-green-500" : "bg-red-500"}`} />
                        {message.text}
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer: Glassy & Polished */}
              <div className="p-4 sm:p-6 border-t bg-white/80 backdrop-blur-md flex flex-col gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2 sm:ml-auto">
                    <Button
                      variant="outline"
                      disabled={publishing}
                      onClick={handlePublishNow}
                      className="h-10 sm:h-12 flex-1 sm:flex-none px-4 sm:px-8 rounded-full border-slate-200 font-bold text-slate-700 hover:bg-slate-50 shadow-sm transition-all text-xs sm:text-sm"
                    >
                      {publishing ? (
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      ) : (
                        "Publish Now"
                      )}
                    </Button>

                    <Button
                      disabled={scheduling || publishing}
                      onClick={handleSchedulePost}
                      className={`h-10 sm:h-12 flex-1 sm:flex-none px-6 sm:px-10 rounded-full font-bold shadow-lg shadow-primary/20 transition-all text-xs sm:text-sm ${dateChanged
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white"
                        }`}
                    >
                      {scheduling ? (
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      ) : (
                        "Schedule Post"
                      )}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50/50 h-10 sm:h-12 px-4 sm:px-6 rounded-xl sm:rounded-2xl font-semibold transition-all w-full sm:w-auto order-2 sm:order-1 text-xs sm:text-sm"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleting}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    {deleteButtonLabel}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the post from your schedule and attempt to delete it from Instagram. This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePost} className="bg-red-500 hover:bg-red-600" disabled={deleting}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </AnimatePresence>
  )

  if (!mounted || typeof window === "undefined") {
    return null
  }

  return createPortal(editorContent, document.body)
}
