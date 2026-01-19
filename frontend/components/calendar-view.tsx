"use client"

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { Pencil, SquarePlay, CircleCheck, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Rows, Film, MoreHorizontal, LayoutGrid, Instagram, Facebook } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer"
import PostEditor from "./post-editor"
import type { Profile } from "@/types/profile"
import { ScheduledPost } from "@/types/scheduled-post"
import type { VideoItemUi } from "@/types/video-item"
import { apiServiceDefault } from "@/services/api/api-service"
import { API_BASE, CLOUD_RUN_BASE, MEDIA_BASE } from "@/services/api/apiConfig"
import { getAuthToken } from "@/utils/getAuthToken"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  isBefore,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameMonth,
  format,
  isToday,
  addMinutes,
  startOfDay,
} from "date-fns"
import {
  type WeekDay,
  type TimeSlot,
  getDaysOfWeek,
  generateTimeSlots,
  doesPostBelongInSlot,
  formatDateRange,
} from "@/utils/date-time"

// Month helpers
function buildMonthMatrix(currentDate: Date, weekStartsOn: 0 | 1) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const weeks: WeekDay[][] = []
  for (let i = 0; i < days.length; i += 7) {
    const row = days.slice(i, i + 7).map((d) => ({
      date: d,
      dayName: format(d, "EEE"),
      dayNumber: Number(format(d, "d")),
      month: format(d, "MMM"),
      isToday: isToday(d),
    }))
    weeks.push(row)
  }
  return weeks
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/**
 * SMART SCHEDULING HELPER
 * 1. If time is in the past relative to NOW -> Bump to Now + 2 mins.
 * 2. If time conflicts with existing post (< 5 mins gap) -> Bump to Existing + 5 mins.
 */
function calculateSafeScheduleTime(targetDate: Date, existingPosts: ScheduledPost[]): Date {
  let proposedDate = new Date(targetDate)
  const now = new Date()

  // 1. Handle "Late" / Past time logic
  // If the proposed time is earlier than now (plus a tiny 1 min processing buffer)
  if (proposedDate.getTime() <= now.getTime() + 60000) {
    // Set to Now + 2 minutes
    proposedDate = addMinutes(now, 2)
  }

  // 2. Handle Collision / Stacking logic
  // Filter for posts on the same day to avoid checking the entire database
  const postsOnDay = existingPosts.filter((p) => isSameDay(new Date(p.scheduled_time), proposedDate))

  // Sort by scheduled time ascending
  postsOnDay.sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())

  // Check against every post. If our proposed date is within 5 minutes of an existing post,
  // bump it to 5 minutes AFTER that existing post.
  // We loop through sorted posts to ensure we keep bumping if the new slot is ALSO taken.
  for (const post of postsOnDay) {
    const pDate = new Date(post.scheduled_time)

    // Check collision (absolute difference < 5 minutes)
    // We mainly care if we are trying to post *on top of* or *too close to* an existing one.
    // Since we sorted, if we bump, we bump forward.
    const diff = Math.abs(proposedDate.getTime() - pDate.getTime())
    const fiveMinutesInMillis = 5 * 60 * 1000

    if (diff < fiveMinutesInMillis) {
      // Set proposed date to the existing post's time + 5 minutes
      proposedDate = addMinutes(pDate, 5)
    }
  }

  return proposedDate
}


type ViewMode = "week" | "month"

type PostWithReel = ScheduledPost & {
  reel_video_url?: string
  reel_thumbnail_url?: string
  message?: string
  thumbnail?: string
  permalink_url?: string
}

function getPostRichness(item: Partial<PostWithReel>) {
  let score = 0
  const trimmedMessage = item.message?.trim()
  if (trimmedMessage) {
    score += 3
  }
  if (item.created_time) {
    score += 1
  }
  if (item.thumbnail || item.reel_thumbnail_url) {
    score += 2
  }
  if (item.permalink_url) {
    score += 1
  }
  return score
}

function uniqueById<T extends { id?: string }>(items: T[]) {
  const seen = new Map<string, { index: number; score: number }>()
  const result: T[] = []

  items.forEach((item) => {
    const id = item.id
    if (!id) {
      result.push(item)
      return
    }

    const score = getPostRichness(item as Partial<PostWithReel>)
    const existing = seen.get(id)
    if (!existing) {
      seen.set(id, { index: result.length, score })
      result.push(item)
      return
    }

    if (score <= existing.score) {
      return
    }

    result[existing.index] = item
    seen.set(id, { index: existing.index, score })
  })

  return result
}

type Rect = { left: number; top: number; width: number; height: number }
type ThumbCacheEntry = { url: string | null; isObjectUrl: boolean; source?: string }

const isPublefyHost = (value: string) => {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return (
      host === "publefy.com" ||
      host === "www.publefy.com"
    )
  } catch {
    return false
  }
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

function toApiMediaUrl(raw?: string | null): string {
  if (!raw) return ""

  const normalized = normalizeRawUrl(raw)
  const mediaBase = (MEDIA_BASE || API_BASE || CLOUD_RUN_BASE || "").replace(/\/+$/, "")
  const apiBase = API_BASE.replace(/\/+$/, "")

  const buildFromPath = (path: string, query: string) => {
    const trimmed = path.replace(/^\/+/, "")

    if (trimmed.startsWith("memes/media/")) {
      return mediaBase ? `${mediaBase}/${trimmed}${query}` : `/${trimmed}${query}`
    }

    const needsProxy = ["instagram_reels/", "bank-mem/", "processed_videos/", "users/"].some((p) =>
      trimmed.startsWith(p),
    )
    if (needsProxy) {
      const encoded = trimmed
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")
      return mediaBase ? `${mediaBase}/memes/media/${encoded}${query}` : `/memes/media/${encoded}${query}`
    }

    return apiBase ? `${apiBase}/${trimmed}${query}` : `/${trimmed}${query}`
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized)
      if (isPublefyHost(normalized)) {
        return buildFromPath(url.pathname, url.search)
      }
    } catch {
      // fall through to relative handling
    }
    return normalized
  }

  return buildFromPath(normalized, "")
}

// Auth helpers for protected media (thumbnails)
function deriveInstagramReelThumb(source?: string | null): string | null {
  if (!source || !/instagram_reels\//i.test(source)) return null
  const noHash = source.split("#")[0] || ""
  const [path, query] = noHash.split("?")
  if (!/\.mp4$/i.test(path)) return null
  const jpgPath = path.replace(/\.mp4$/i, ".jpg")
  return query ? `${jpgPath}?${query}` : jpgPath
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

interface CalendarViewProps {
  currentDate: Date
  profile: Profile | null
  videoItems: VideoItemUi[]
  scheduledPosts: ScheduledPost[] | null
  onDateChange?: (date: Date) => void
  weekStartsOn?: 0 | 1
  startHour?: number
  endHour?: number
  onPostUpdate?: (post: ScheduledPost) => void
  onPostDelete?: (postId: string) => void
}

export function CalendarView({
  currentDate,
  profile,
  videoItems,
  scheduledPosts,
  onDateChange,
  weekStartsOn = 1,
  startHour = 0,
  endHour = 24,
  onPostUpdate,
  onPostDelete,
}: CalendarViewProps) {
  const [postsState, setPosts] = useState<ScheduledPost[]>([])
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<VideoItemUi | null>(null)
  const [selectedPostIsOld, setSelectedPostIsOld] = useState(false)
  const [postEditorOpen, setPostEditorOpen] = useState(false)
  const [dragOver, setDragOver] = useState<{ day: WeekDay; timeSlot?: TimeSlot } | null>(null)
  const [userTimeZone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("week")
  const [editorOrigin, setEditorOrigin] = useState<Rect | null>(null)
  const pendingDraftRef = useRef<Record<string, { parsed: any }>>({})

  // OLD posts (published/failed/past)
  const [oldPosts, setOldPosts] = useState<PostWithReel[]>([])

  const isMobile = useMediaQuery("(max-width: 768px)")
  const prefersReducedMotion = useReducedMotion()

  // hydrate from parent
  useEffect(() => {
    if (scheduledPosts) setPosts(scheduledPosts)
  }, [scheduledPosts])

  // load OLD
  useEffect(() => {
    let active = true
    const loadOld = async () => {
      try {
        if (!profile?.id) {
          if (active) setOldPosts([])
          return
        }
        const res = await apiServiceDefault.get(
          `instagram/scheduled-posts/enriched?window=old&profile_id=${encodeURIComponent(profile.id)}&limit=500`,
        )
        const list = ((res as any)?.posts || (res as any)?.data?.posts || []) as PostWithReel[]
        if (active) setOldPosts(list)
      } catch {
        if (active) setOldPosts([])
      }
    }
    loadOld()
    return () => {
      active = false
    }
  }, [profile?.id])

  // week/month data
  const daysOfWeek = useMemo(() => getDaysOfWeek(currentDate, weekStartsOn), [currentDate, weekStartsOn])
  const timeSlots = useMemo(() => {
    const actualStartHour = isMobile ? Math.max(8, startHour) : startHour
    const actualEndHour = isMobile ? Math.min(20, endHour) : endHour
    return generateTimeSlots(actualStartHour, actualEndHour)
  }, [startHour, endHour, isMobile])
  const monthMatrix = useMemo(() => buildMonthMatrix(currentDate, weekStartsOn), [currentDate, weekStartsOn])

  // nav
  const goPrev = useCallback(() => {
    const newDate = viewMode === "week" ? subWeeks(currentDate, 1) : subMonths(currentDate, 1)
    onDateChange?.(newDate)
  }, [currentDate, onDateChange, viewMode])
  const goNext = useCallback(() => {
    const newDate = viewMode === "week" ? addWeeks(currentDate, 1) : addMonths(currentDate, 1)
    onDateChange?.(newDate)
  }, [currentDate, onDateChange, viewMode])
  const goToToday = useCallback(() => onDateChange?.(new Date()), [onDateChange])

  // queries
  const getPostsForSlot = useCallback(
    (day: WeekDay, timeSlot: TimeSlot) => postsState.filter((post) => doesPostBelongInSlot(post, day, timeSlot)),
    [postsState],
  )
  const getPostsForDay = useCallback(
    (day: Date) => postsState.filter((p) => isSameDay(new Date(p.scheduled_time), day)),
    [postsState],
  )
  const getOldPostsForSlot = useCallback(
    (day: WeekDay, timeSlot: TimeSlot) => oldPosts.filter((post) => doesPostBelongInSlot(post, day, timeSlot)),
    [oldPosts],
  )
  const getOldPostsForDay = useCallback(
    (day: Date) => oldPosts.filter((p) => isSameDay(new Date(p.scheduled_time), day)),
    [oldPosts],
  )

  const isSlotInPast = useCallback((day: WeekDay, timeSlot: TimeSlot) => {
    const now = new Date()
    const slotDate = new Date(day.date)
    slotDate.setHours(timeSlot.hour, 0, 0, 0)
    return isBefore(slotDate, now)
  }, [])

  // drag helpers
  const handleDragOver = useCallback((e: React.DragEvent, day: WeekDay, timeSlot?: TimeSlot) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"

    // Only update state if we've actually moved to a different cell
    setDragOver((prev) => {
      const isSameDay = prev?.day.date.getTime() === day.date.getTime()
      const isSameSlot = prev?.timeSlot?.hour === timeSlot?.hour
      if (isSameDay && isSameSlot) return prev
      return { day, timeSlot }
    })
  }, [])
  const handleDragLeave = useCallback(() => setDragOver(null), [])

  const openEditorFromCell = useCallback(
    (post: ScheduledPost, video: VideoItemUi | null, cellEl?: HTMLElement | null, isOldPost = false) => {
      setSelectedPost(post)
      setSelectedVideo(video)
      setSelectedPostIsOld(isOldPost)
      if (cellEl) {
        const r = cellEl.getBoundingClientRect()
        setEditorOrigin({ left: r.left, top: r.top, width: r.width, height: r.height })
      } else {
        setEditorOrigin(null)
      }
      setPostEditorOpen(true)
    },
    [],
  )

  // 🔄 server-truth refresh for a single post (used after editor updates)
  const refreshPostFromServer = useCallback(
    async (id: string) => {
      try {
        const res = await apiServiceDefault.get(`/instagram/scheduled-posts/${id}/enriched`)
        const fresh = ((res as any)?.post || (res as any)?.data?.post) as PostWithReel | undefined
        if (!fresh) return

        const status = (fresh as any)?.status?.toString?.().toLowerCase?.() || ""
        const isOld =
          ["published", "failed", "error", "live", "success"].includes(status) ||
          new Date(fresh.scheduled_time).getTime() < Date.now()

        setPosts((prev) => {
          const others = prev.filter((p) => p.id !== fresh.id)
          return isOld ? others : [...others, fresh]
        })
        setOldPosts((prev) => {
          const others = prev.filter((p) => p.id !== fresh.id)
          return isOld ? [...others, fresh] : others
        })
      } catch {
        // ignore
      }
    },
    [setPosts, setOldPosts],
  )

  // create/move (returns post so we can open editor)
  const createOrMovePost = useCallback(
    async (targetDate: Date, parsed: any): Promise<ScheduledPost | null> => {
      const whenISO = new Date(targetDate).toISOString()

      // move existing
      if (parsed?.id && parsed?.scheduled_time) {
        const existingPost = postsState.find((x) => x.id === parsed.id)
        if (!existingPost) return null

        const updated: ScheduledPost = { ...existingPost, scheduled_time: whenISO }
        const revertSnapshot = postsState
        setPosts((prev) => prev.map((p) => (p.id === existingPost.id ? updated : p)))
        setSelectedPost((prev) => (prev && prev.id === existingPost.id ? updated : prev))

        const patchPromise = (async () => {
          try {
            await apiServiceDefault.patch(`/instagram/scheduled-posts/${existingPost.id}`, {
              scheduled_time: whenISO,
              client_tz: userTimeZone,
            })
          } catch (err: any) {
            const msg =
              err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to reschedule."
            setPosts(revertSnapshot)
            setSelectedPost((prev) => (prev && prev.id === existingPost.id ? existingPost : prev))
            alert(msg)
          }
        })()
        void patchPromise
        return updated
      }

      // create new draft from video
      if (parsed?.id && (parsed?.video_url || parsed?.media_url)) {
        if (!profile?.id) {
          try {
            window.dispatchEvent(new CustomEvent("coachmark:add-account", { detail: { source: "calendar-drop" } }))
          } catch { }
          return null
        }

        const tempId = `temp-${Date.now()}`
        const optimisticPost: ScheduledPost = {
          ...(new ScheduledPost() as any),
          id: tempId,
          reel_id: parsed.id,
          profile_id: profile.id,
          scheduled_time: whenISO,
          created_time: new Date().toISOString(),
          status: "draft" as any,
          caption: parsed.caption ?? "",
          hashtags: parsed.hashtags ?? [],
          client_tz: userTimeZone as any,
        }
        setPosts((prev) => [...prev, optimisticPost])
        setSelectedPost(optimisticPost)
        pendingDraftRef.current[tempId] = { parsed }

        return optimisticPost
      }

      alert("Invalid item dropped.")
      return null
    },
    [postsState, profile?.id, userTimeZone],
  )

  // --------------------------
  // 📸 Thumbnail + Video helpers
  // --------------------------
  // Shared thumb cache across cards to avoid repeated blob downloads
  const [, forceThumbTick] = useState(0)
  const thumbCacheRef = useRef<Record<string, ThumbCacheEntry | undefined>>({})
  const thumbInflightRef = useRef<Record<string, Promise<string | null>>>({})
  const thumbGenerationRef = useRef(0)

  const revokeThumbEntry = useCallback((entry?: ThumbCacheEntry) => {
    const url = entry?.url
    if (entry?.isObjectUrl && url && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
    }
  }, [])

  const getThumbKey = useCallback((post: PostWithReel) => post.reel_id || post.id || "", [])

  const getCachedThumb = useCallback(
    (post: PostWithReel): string | null => {
      const key = getThumbKey(post)
      if (!key) return null
      const cached = thumbCacheRef.current[key]
      return cached?.url ?? null
    },
    [getThumbKey],
  )

  const ensureThumb = useCallback(
    async (post: PostWithReel): Promise<string | null> => {
      const key = getThumbKey(post)
      if (!key) return null
      const generation = thumbGenerationRef.current

      // Check cache - only return if it's NOT null (to allow retries if null was cached)
      const cached = thumbCacheRef.current[key]
      if (cached !== undefined && cached?.url !== null) {
        return cached.url
      }

      const inflight = thumbInflightRef.current[key]
      if (inflight) return inflight

      const promise = (async () => {
        const postThumb =
          (post as any)?.thumbnail ||
          (post as any)?.thumbnail_url ||
          post.reel_thumbnail_url ||
          ""

        const match = videoItems.find((x) => x.id === post.reel_id) as any
        const matchThumb = match?.thumbnail_url || match?.thumb || match?.thumbnail || ""

        // Fallback: Infer from video URL if available
        const videoUrl = match?.video_url || post.reel_video_url || ""
        const inferred = deriveInstagramReelThumb(videoUrl)

        const raw = postThumb || matchThumb || inferred || ""

        if (!raw) {
          // Keep null cache so we don't spam repeat checks, but allow re-check if videoItems update
          thumbCacheRef.current[key] = { url: null, isObjectUrl: false }
          return null
        }

        const normalized = toApiMediaUrl(raw)
        let finalUrl = normalized
        let isObjectUrl = false
        if (shouldAttachAuth(normalized)) {
          try {
            finalUrl = await fetchAsObjectURL(normalized)
            isObjectUrl = finalUrl.startsWith("blob:")
          } catch {
            finalUrl = normalized
          }
        }
        const nextEntry: ThumbCacheEntry = { url: finalUrl, isObjectUrl }
        const prev = thumbCacheRef.current[key]
        if (prev?.url && prev.url !== nextEntry.url) {
          revokeThumbEntry(prev)
        }
        if (thumbGenerationRef.current !== generation) {
          revokeThumbEntry(nextEntry)
          return null
        }
        thumbCacheRef.current[key] = nextEntry
        forceThumbTick((v) => v + 1)
        return nextEntry.url
      })()

      thumbInflightRef.current[key] = promise
      promise.finally(() => {
        delete thumbInflightRef.current[key]
      })
      return promise
    },
    [videoItems, getThumbKey, revokeThumbEntry],
  )

  // Preload thumbnails for visible posts without duplicating fetches
  useEffect(() => {
    const all = [...postsState, ...oldPosts]
    all.forEach((post) => {
      if (post) ensureThumb(post as any)
    })
  }, [postsState, oldPosts, ensureThumb])

  useEffect(() => {
    return () => {
      thumbGenerationRef.current += 1
      Object.values(thumbCacheRef.current).forEach((entry) => revokeThumbEntry(entry))
      thumbCacheRef.current = {}
      thumbInflightRef.current = {}
    }
  }, [profile?.id, revokeThumbEntry])

  const ensurePostForEditor = useCallback(async (): Promise<ScheduledPost | null> => {
    if (!selectedPost || !selectedVideo) return null
    const isTempId = (id?: string) => !id || id.toString().startsWith("temp-") || /^\d{13,}$/.test(id.toString())
    if (selectedPost.id && !isTempId(selectedPost.id)) return selectedPost

    const ctx = selectedPost.id ? pendingDraftRef.current[selectedPost.id] : null
    const parsed = ctx?.parsed || {}
    const reelId = selectedVideo.reel_id || (selectedVideo as any)?.id
    if (!profile?.id || !reelId) {
      throw new Error("Missing profile or reel reference.")
    }

    const basePayload = {
      reel_id: reelId,
      profile_id: profile.id,
      scheduled_time: selectedPost.scheduled_time || new Date().toISOString(),
      caption: parsed.caption ?? (selectedPost as any)?.caption ?? "",
      hashtags: parsed.hashtags ?? (selectedPost as any)?.hashtags ?? [],
      activate: false,
      client_tz: userTimeZone,
      thumbnail_url: parsed.thumbnail_url ?? "",
    }

    const applyRealPost = (real: ScheduledPost) => {
      setPosts((prev) => prev.map((p) => (p.id === selectedPost.id ? real : p)))
      setSelectedPost(real)
      delete pendingDraftRef.current[selectedPost.id]
      return real
    }

    const removeTemp = () => {
      setPosts((prev) => prev.filter((p) => p.id !== selectedPost.id))
      delete pendingDraftRef.current[selectedPost.id]
    }

    const scheduleOnce = async () => {
      const res = await apiServiceDefault.post(`/instagram/schedule/`, basePayload)
      const data = (res as any)?.data ?? res
      const realPost: ScheduledPost = {
        ...(new ScheduledPost() as any),
        ...selectedPost,
        id: data?.id ?? data?._id ?? `${Date.now()}`,
        reel_id: basePayload.reel_id,
        profile_id: basePayload.profile_id,
        scheduled_time: basePayload.scheduled_time,
        status: (data?.status as any) || ("draft" as any),
        caption: basePayload.caption,
        hashtags: basePayload.hashtags,
        client_tz: basePayload.client_tz as any,
        ...(basePayload.thumbnail_url ? ({ thumbnail_url: basePayload.thumbnail_url } as any) : {}),
      }
      return applyRealPost(realPost)
    }

    try {
      return await scheduleOnce()
    } catch (err: any) {
      const status = err?.response?.status
      const errText = err?.response?.data?.error || err?.response?.data?.message || err?.message || ""
      const looksMissing = status === 404 && /reel not found/i.test(errText || "Reel not found")
      if (!looksMissing) {
        throw err
      }

      const media_url =
        parsed.video_url ||
        parsed.media_url ||
        (selectedVideo as any).video_url ||
        (selectedVideo as any).media_url ||
        ""
      if (!media_url) {
        removeTemp()
        throw new Error("This item does not have a downloadable media_url to upload.")
      }

      await apiServiceDefault.post(`/instagram/upload-reel`, {
        reel_id: reelId,
        media_url,
        caption: parsed.caption ?? "",
        thumbnail_url: parsed.thumbnail_url ?? "",
        permalink: parsed.permalink ?? "",
        timestamp: parsed.timestamp ?? new Date().toISOString(),
        like_count: parsed.like_count ?? 0,
        comments_count: parsed.comments_count ?? 0,
        media_type: "VIDEO",
      })

      try {
        return await scheduleOnce()
      } catch (err2) {
        removeTemp()
        throw err2
      }
    }
  }, [selectedPost, selectedVideo, profile?.id, userTimeZone, setPosts])

  const getVideoSrc = useCallback(
    (post: PostWithReel) => {
      const match = videoItems.find((x) => x.id === post.reel_id)
      const url = match?.video_url || post.reel_video_url || ""
      return toApiMediaUrl(url)
    },
    [videoItems],
  )

  const readText = (value: unknown) => {
    if (typeof value === "string") return value.trim()
    if (value === null || value === undefined) return ""
    return String(value)
  }

  const formatCreatedTime = (value: unknown) => {
    if (!value) return ""
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.toISOString()
    }
    if (typeof value === "string") return value
    return String(value)
  }

  const PostedReelMeta: React.FC<{ post: PostWithReel }> = React.memo(({ post }) => {
    const message = readText((post as any)?.message || (post as any)?.caption)
    const createdTime = formatCreatedTime((post as any)?.created_time ?? post.scheduled_time)
    const permalinkValue = readText((post as any)?.permalink_url)

    return (
      <div className="space-y-1.5 max-w-xs p-1">
        <div className="text-xs font-semibold text-slate-800">
          {message ? (
            <p className="line-clamp-2 break-words">{message}</p>
          ) : (
            <p className="text-slate-400 italic">No message</p>
          )}
        </div>
        <div className="text-[10px] text-slate-500">
          {createdTime ? (
            <span>Created: {format(new Date(createdTime), "MMM d, yyyy 'at' h:mm a")}</span>
          ) : (
            <span>No date</span>
          )}
        </div>
        {permalinkValue && (
          <div className="text-[10px] text-slate-500">
            <a
              href={permalinkValue}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on Instagram
            </a>
          </div>
        )}
      </div>
    )
  })

  const PostedReelTooltip: React.FC<{ post: PostWithReel; children: React.ReactNode }> = ({
    post,
    children,
  }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>
          <PostedReelMeta post={post} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )

  // drops
  const handleDropWeek = useCallback(
    async (e: React.DragEvent, day: WeekDay, timeSlot: TimeSlot) => {
      e.preventDefault()
      setDragOver(null)

      // Strict Check: Blocks scheduling on completely past days (Yesterday or earlier)
      // We allow "Today" because the helper function will fix the hour/minute if it's late.
      if (isBefore(day.date, startOfDay(new Date()))) {
        alert("Cannot schedule posts on past dates.")
        return
      }

      if (!profile?.id) {
        try {
          window.dispatchEvent(new CustomEvent("coachmark:add-account", { detail: { source: "calendar-drop" } }))
        } catch { }
        return
      }

      try {
        const data = e.dataTransfer.getData("application/json")
        if (!data) return
        const parsed = JSON.parse(data)

        // Initial target based on the grid slot dropped on
        const baseDate = new Date(day.date)
        baseDate.setHours(timeSlot.hour, 0, 0, 0)

        // Calculate the smart time (handles "now" and "5 min gap")
        const smartDate = calculateSafeScheduleTime(baseDate, postsState)

        const post = await createOrMovePost(smartDate, parsed)
        if (post) {
          const vid = videoItems.find((x) => x.id === post.reel_id) || null
          openEditorFromCell(post, vid, e.currentTarget as HTMLElement)
        }
      } catch (err) {
        console.error("Error scheduling post:", err)
        alert("An error occurred while scheduling the post.")
      }
    },
    [createOrMovePost, videoItems, openEditorFromCell, postsState],
  )

  const handleDropMonth = useCallback(
    async (e: React.DragEvent, dayDate: Date) => {
      e.preventDefault()
      setDragOver(null)

      // Strict Check: Blocks scheduling on completely past days
      if (isBefore(dayDate, startOfDay(new Date()))) {
        alert("Cannot schedule posts on past dates.")
        return
      }

      if (!profile?.id) {
        try {
          window.dispatchEvent(new CustomEvent("coachmark:add-account", { detail: { source: "calendar-drop" } }))
        } catch { }
        return
      }

      try {
        const data = e.dataTransfer.getData("application/json")
        if (!data) return
        const parsed = JSON.parse(data)

        // Default to Noon for month view drops
        const baseDate = new Date(dayDate)
        baseDate.setHours(12, 0, 0, 0)

        // Calculate the smart time
        const smartDate = calculateSafeScheduleTime(baseDate, postsState)

        const post = await createOrMovePost(smartDate, parsed)
        if (post) {
          const vid = videoItems.find((x) => x.id === post.reel_id) || null
          openEditorFromCell(post, vid, e.currentTarget as HTMLElement)
        }
      } catch (err) {
        console.error("Error scheduling post:", err)
        alert("An error occurred while scheduling the post.")
      }
    },
    [createOrMovePost, videoItems, openEditorFromCell, postsState],
  )

  // post interactions
  const selectPostForViewing = useCallback(
    (post: PostWithReel) => {
      const match = videoItems.find((x) => x.id === post.reel_id)
      if (match) {
        openEditorFromCell(post, match, undefined, true)
        return
      }
      const fallback = post.reel_video_url
      if (fallback) {
        const v = {
          id: post.reel_id || post.id,
          type: "video" as const,
          video_url: fallback,
          selected: false,
        } as any
        openEditorFromCell(post, v, undefined, true)
        return
      }
      alert("Video not found for this post.")
    },
    [videoItems, openEditorFromCell],
  )

  const handlePostClick = useCallback(
    (post: ScheduledPost) => {
      const video = videoItems.find((x) => x.id === post.reel_id)
      openEditorFromCell(post, video || null, undefined, false)
    },
    [videoItems, openEditorFromCell],
  )

  // ✅ central update: local update + server refresh + propagate up if needed
  const handlePostUpdate = useCallback(
    (updatedPost: ScheduledPost) => {
      setPosts((prev) => prev.map((post) => (post.id === updatedPost.id ? updatedPost : post)))
      setPostEditorOpen(false)
      refreshPostFromServer(updatedPost.id)
      onPostUpdate?.(updatedPost)
    },
    [onPostUpdate, refreshPostFromServer],
  )

  const handlePostDelete = useCallback(
    (postId: string) => {
      setPosts((prev) => prev.filter((post) => post.id !== postId))
      setOldPosts((prev) => prev.filter((post) => post.id !== postId))
      if (postId?.toString().startsWith("temp-")) {
        delete pendingDraftRef.current[postId]
      }
      setSelectedPost(null)
      setSelectedVideo(null)
      setSelectedPostIsOld(false)
      setEditorOrigin(null)
      setPostEditorOpen(false)
      onPostDelete?.(postId)
    },
    [onPostDelete],
  )


  const SlotPostCard: React.FC<{
    post: ScheduledPost
    onClick: () => void
    onDragStart?: (e: React.DragEvent) => void
    compact?: boolean
  }> = React.memo(({ post, onClick, onDragStart, compact }) => {
    const thumb = getCachedThumb(post as any)
    useEffect(() => {
      ensureThumb(post as any)
    }, [post, ensureThumb])
    const src = getVideoSrc(post as any)
    if (!thumb && !src) return null

    // Get video duration from videoItems if available
    const videoMatch = videoItems.find((x) => x.id === post.reel_id)
    const videoDuration = (videoMatch as any)?.duration || (videoMatch as any)?.video_duration || ""

    if (compact) {
      return (
        <div
          className={cn(
            "flex items-center gap-2 p-1.5 rounded-md hover:bg-[#7C7EF4]/10 transition-colors group cursor-pointer",
            "border border-transparent hover:border-[#7C7EF4]/20",
            dragOver && "pointer-events-none"
          )}
          onClick={onClick}
          draggable={!!onDragStart}
          onDragStart={onDragStart}
        >
          <div className="w-8 h-12 bg-slate-900 rounded overflow-hidden flex-shrink-0">
            {thumb ? (
              <img src={thumb} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <Film className="h-3 w-3" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-medium text-slate-700 truncate">
              {post.caption || "No caption"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                {format(new Date(post.scheduled_time), "ha")}
              </span>
              <div className="h-1 w-1 rounded-full bg-[#7C7EF4]" />
              <Instagram className="h-2.5 w-2.5 text-[#E1306C]" />
            </div>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil className="h-3 w-3 text-[#7C7EF4]" />
          </div>
        </div>
      )
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "m-0 relative group cursor-pointer rounded-md shadow-sm hover:shadow-md transition-all duration-200 border-2 border-transparent hover:border-[#7C7EF4]",
                dragOver && "pointer-events-none"
              )}
              onClick={onClick}
              draggable
              onDragStart={onDragStart}
            >
              <div className="relative w-[20px] h-[20px] rounded overflow-hidden bg-slate-900">
                {thumb ? (
                  <img src={thumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                    <Film className="h-2.5 w-2.5" />
                  </div>
                )}
                {/* Duration overlay - top left */}
                {videoDuration && (
                  <div className="absolute top-0 left-0 bg-black/70 px-0.5 py-0 text-[6px] text-white font-medium leading-tight">
                    {videoDuration}
                  </div>
                )}
                {/* Play icon - bottom right */}
                <div className="absolute bottom-0 right-0 p-0.5">
                  <SquarePlay className="h-1.5 w-1.5 text-white drop-shadow-lg" />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 rounded transition-opacity duration-200 pointer-events-none">
                <Pencil className="h-2.5 w-2.5 text-white drop-shadow-md" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="p-2">
            <p className="max-w-[240px] font-medium line-clamp-2">{post.caption || "No caption"}</p>
            <p className="text-xs text-muted-foreground pt-1">
              Scheduled: {format(new Date(post.scheduled_time), "MMM d, h:mm a")}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  })

  const CalendarPostChip: React.FC<{
    post: ScheduledPost
    onClick: () => void
    onDragStart?: (e: React.DragEvent) => void
  }> = React.memo(({ post, onClick, onDragStart }) => {
    const thumb = getCachedThumb(post as any)
    useEffect(() => {
      ensureThumb(post as any)
    }, [post, ensureThumb])

    // Get video duration from videoItems if available
    const videoMatch = videoItems.find((x) => x.id === post.reel_id)
    const videoDuration = (videoMatch as any)?.duration || (videoMatch as any)?.video_duration || ""

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
              draggable={!!onDragStart}
              onDragStart={onDragStart}
              className={cn(
                "relative w-[20px] h-[20px] rounded overflow-hidden bg-slate-900 shadow-sm hover:shadow-md transition-all cursor-pointer group",
                "border-2 border-transparent hover:border-[#7C7EF4]",
                dragOver && "pointer-events-none"
              )}
            >
              {thumb ? (
                <img src={thumb} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-900 text-white">
                  <Film className="h-2.5 w-2.5" />
                </div>
              )}

              {/* Duration overlay - top left */}
              {videoDuration && (
                <div className="absolute top-0 left-0 bg-black/70 px-0.5 py-0 text-[6px] text-white font-medium leading-tight">
                  {videoDuration}
                </div>
              )}

              {/* Play icon - bottom right */}
              <div className="absolute bottom-0 right-0 p-0.5">
                <SquarePlay className="h-1.5 w-1.5 text-white drop-shadow-lg" />
              </div>

              {/* Hover edit overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 rounded transition-opacity duration-200 pointer-events-none">
                <Pencil className="h-2.5 w-2.5 text-white drop-shadow-md" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="p-2">
            <p className="max-w-[240px] font-medium line-clamp-2">{post.caption || "No caption"}</p>
            <p className="text-xs text-muted-foreground pt-1">
              Scheduled: {format(new Date(post.scheduled_time), "MMM d, h:mm a")}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  })

  const SlotExpandContent: React.FC<{
    posts: ScheduledPost[]
    oldPosts: PostWithReel[]
    day: WeekDay | Date
    timeSlot?: TimeSlot
    onDragStart?: (e: React.DragEvent, post: ScheduledPost) => void
  }> = ({ posts: rawPosts, oldPosts, day, timeSlot, onDragStart }) => {
    const date = day instanceof Date ? day : day.date
    const timeLabel = timeSlot ? timeSlot.timeString : format(date, "MMM d, yyyy")

    // Filter out posts that are already in oldPosts to avoid duplicates in "Scheduled" list
    const oldIds = new Set(oldPosts.map(p => p.id).filter(Boolean))
    const posts = rawPosts.filter(p => !oldIds.has(p.id))

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1 dashboard-calendar-scroll">
          {oldPosts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Completed / Past</p>
              {oldPosts.map((p) => (
                <div
                  key={`old-${p.id}`}
                  className="opacity-75"
                >
                  <SlotPostCard
                    post={p}
                    compact
                    onClick={() => selectPostForViewing(p)}
                  />
                </div>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Scheduled</p>
              {posts.map((p) => (
                <SlotPostCard
                  key={p.id}
                  post={p}
                  compact
                  onClick={() => handlePostClick(p)}
                  onDragStart={onDragStart ? (e) => onDragStart(e, p) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  const SlotExpandView: React.FC<{
    posts: ScheduledPost[]
    oldPosts: PostWithReel[]
    day: WeekDay | Date
    timeSlot?: TimeSlot
    trigger: React.ReactNode
  }> = ({ posts, oldPosts, day, timeSlot, trigger }) => {
    const isMob = useMediaQuery("(max-width: 768px)")
    const date = day instanceof Date ? day : day.date
    const timeLabel = timeSlot ? timeSlot.timeString : format(date, "MMMM d")

    const handleExpandDragStart = (e: React.DragEvent, post: ScheduledPost) => {
      e.dataTransfer.setData("application/json", JSON.stringify(post))
    }

    if (isMob) {
      return (
        <Drawer>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent className="px-4 pb-8">
            <DrawerHeader className="px-0 mb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <DrawerTitle className="text-xl font-bold text-[#301B69] mb-1">
                    {format(date, "EEEE")}
                  </DrawerTitle>
                  <p className="text-sm text-slate-500">
                    {timeLabel} • {posts.length + oldPosts.length} posts
                  </p>
                </div>
                <div className="h-10 w-10 flex items-center justify-center bg-[#F5F0FF] rounded-full text-[#7C7EF4]">
                  <LayoutGrid className="h-5 w-5" />
                </div>
              </div>
            </DrawerHeader>
            <SlotExpandContent
              posts={posts}
              oldPosts={oldPosts}
              day={day}
              timeSlot={timeSlot}
              onDragStart={handleExpandDragStart}
            />
          </DrawerContent>
        </Drawer>
      )
    }

    return (
      <Popover>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent className="w-[360px] p-4 bg-white/95 backdrop-blur-md border-[#E7E5F7] shadow-xl rounded-xl">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-[#301B69]">{format(date, "EEEE, MMM d")}</h3>
              {timeSlot && <p className="text-[10px] text-slate-500 font-medium">{timeSlot.timeString}</p>}
            </div>
            <div className="px-2 py-0.5 bg-[#F5F0FF] rounded-full">
              <span className="text-[10px] font-bold text-[#7C7EF4]">{posts.length + oldPosts.length} items</span>
            </div>
          </div>
          <SlotExpandContent
            posts={posts}
            oldPosts={oldPosts}
            day={day}
            timeSlot={timeSlot}
            onDragStart={handleExpandDragStart}
          />
        </PopoverContent>
      </Popover>
    )
  }

  // render
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-[#E7E5F7]/40 p-3 md:p-4 bg-white/40 backdrop-blur-sm">
        {/* Mobile: 2 rows, Desktop: 1 row */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-2">
          {/* Row 1: Today + Arrows + Date Range */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className={cn(
                "rounded-full bg-white/30 backdrop-blur-sm border border-white/40",
                "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
                "hover:bg-white/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
                "h-10 md:h-9", // Larger touch target on mobile
                prefersReducedMotion ? "" : "transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              )}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goPrev}
              aria-label="Previous"
              className={cn(
                "rounded-full bg-white/30 backdrop-blur-sm border border-white/40",
                "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
                "hover:bg-white/40",
                "h-10 w-10 md:h-9 md:w-9", // Larger touch target on mobile
                prefersReducedMotion ? "" : "transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              )}
            >
              <ChevronLeft className="h-4 w-4 text-[#301B69]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goNext}
              aria-label="Next"
              className={cn(
                "rounded-full bg-white/30 backdrop-blur-sm border border-white/40",
                "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
                "hover:bg-white/40",
                "h-10 w-10 md:h-9 md:w-9", // Larger touch target on mobile
                prefersReducedMotion ? "" : "transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              )}
            >
              <ChevronRight className="h-4 w-4 text-[#301B69]" />
            </Button>
            {viewMode === "week" ? (
              <span className="font-medium text-[#301B69] text-sm md:text-base">{formatDateRange(currentDate, weekStartsOn)}</span>
            ) : (
              <span className="font-medium text-[#301B69] text-sm md:text-base">{format(currentDate, "MMMM yyyy")}</span>
            )}
          </div>

          {/* Row 2: Timezone + Week/Month Toggle */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div className="text-xs md:text-sm text-[#5A5192]">Timezone: {userTimeZone}</div>
            <div className="flex rounded-full bg-white/30 backdrop-blur-sm border border-white/40 p-1 shadow-sm overflow-hidden">
              <Button
                variant={viewMode === "week" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2 rounded-full h-9 md:h-8", // Larger touch target on mobile
                  viewMode === "week"
                    ? "bg-[#301B69] text-white shadow-sm"
                    : "text-[#301B69] hover:bg-white/40",
                  prefersReducedMotion ? "" : "transition-all duration-200"
                )}
                onClick={() => setViewMode("week")}
              >
                <Rows className="h-4 w-4" /> <span className="text-xs md:text-sm">Week</span>
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2 rounded-full h-9 md:h-8", // Larger touch target on mobile
                  viewMode === "month"
                    ? "bg-[#301B69] text-white shadow-sm"
                    : "text-[#301B69] hover:bg-white/40",
                  prefersReducedMotion ? "" : "transition-all duration-200"
                )}
                onClick={() => setViewMode("month")}
              >
                <CalendarIcon className="h-4 w-4" /> <span className="text-xs md:text-sm">Month</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto dashboard-calendar-scroll">
        {viewMode === "week" ? (
          <div className="relative lg:min-h-full">
            {/* Days Header */}
            <div className="sticky top-0 z-10 bg-white/60 backdrop-blur-sm border-b border-[#E7E5F7]/40">
              <div className="grid grid-cols-[auto_repeat(7,1fr)]">
                <div className="border-r border-[#E7E5F7]/40 border-b p-2 min-w-[44px] md:min-w-[48px] w-12" />
                {daysOfWeek.map((day, index) => (
                  <div
                    key={index}
                    className={cn(
                      "text-center p-2 border-b border-[#E7E5F7]/40",
                      index < 6 && "border-r border-[#E7E5F7]/40",
                      day.isToday && "bg-[#F5F0FF]/50",
                      "flex items-center justify-center gap-1.5"
                    )}
                  >
                    <span className="text-[10px] font-normal text-[#5A5192] uppercase tracking-wide">{day.dayName}</span>
                    <span className="text-[11px] font-normal text-[#301B69]">{day.dayNumber}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Time grid */}
            <div className={isLoading ? "opacity-50 pointer-events-none" : ""}>
              {timeSlots.map((timeSlot, slotIndex) => (
                <div key={timeSlot.timeString} className="grid grid-cols-[auto_repeat(7,1fr)]">
                  <div className={cn(
                    "py-0.5 px-1.5 border-r border-[#E7E5F7]/60 border-b text-[10px] text-right",
                    "min-w-[44px] md:min-w-[40px] w-10", // Reduced width for compact display
                    slotIndex % 2 === 0 ? "bg-slate-50/60" : "bg-slate-50/40",
                    "text-[#5A5192] font-medium leading-tight"
                  )}>
                    {timeSlot.timeString}
                  </div>
                  {daysOfWeek.map((day, dayIndex) => {
                    const postsInSlot = getPostsForSlot(day, timeSlot)
                    const oldInSlot = getOldPostsForSlot(day, timeSlot)
                    const isPast = isSlotInPast(day, timeSlot)
                    const isDragOver =
                      dragOver?.day.date.getTime() === day.date.getTime() && dragOver?.timeSlot?.hour === timeSlot.hour

                    return (
                      <div
                        key={dayIndex}
                        className={cn(
                          "border-b border-r border-[#E7E5F7]/60 min-h-[28px] h-[28px] relative transition-colors duration-150",
                          slotIndex % 2 === 0 ? "bg-white/60" : "bg-white/40",
                          isPast && "bg-[#E8E0F5]/60",
                          isDragOver && "bg-[#7C7EF4]/20",
                          "flex flex-col p-0.5 overflow-hidden"
                        )}
                        onDragOver={(e) => handleDragOver(e, day, timeSlot)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropWeek(e, day, timeSlot)}
                        aria-label={`${day.dayName} at ${timeSlot.timeString}`}
                      >
                        {/* Portraits stack (horizontal row to keep cell height stable) */}
                        <div className="flex-1 flex flex-wrap gap-1.5 items-start justify-center overflow-hidden">
                          {(() => {
                            const seen = new Set();
                            // Precedence: If a post is in both lists, it's considered "Old/Completed"
                            const combined = [...oldInSlot, ...postsInSlot].filter((p) => {
                              if (!p.id || seen.has(p.id)) return false;
                              seen.add(p.id);
                              return true;
                            });

                            const limit = isMobile ? 1 : 2
                            const visible = combined.slice(0, limit)
                            const remaining = combined.length - limit

                            const oldIds = new Set(oldInSlot.map(p => p.id).filter(Boolean))
                            const filteredPostsInSlot = postsInSlot.filter(p => !oldIds.has(p.id))

                            return (
                              <>
                                {visible.map((p) => {
                                  const isOld = oldIds.has(p.id)
                                  return (
                                    <CalendarPostChip
                                      key={p.id}
                                      post={p}
                                      onClick={() => (isOld ? selectPostForViewing(p) : handlePostClick(p))}
                                      onDragStart={isOld ? undefined : (e) =>
                                        e.dataTransfer.setData("application/json", JSON.stringify(p))
                                      }
                                    />
                                  )
                                })}

                                {remaining > 0 && (
                                  <SlotExpandView
                                    posts={filteredPostsInSlot}
                                    oldPosts={oldInSlot}
                                    day={day}
                                    timeSlot={timeSlot}
                                    trigger={
                                      <div className="flex items-center justify-center p-0.5 rounded-full bg-[#7C7EF4] text-white shadow-sm hover:bg-[#301B69] transition-colors cursor-pointer group">
                                        <span className="text-[8px] font-bold leading-none">+{remaining}</span>
                                      </div>
                                    }
                                  />
                                )}

                                {/* If we click an empty or single-item cell, it should also support expand view on mobile */}
                                {combined.length > 0 && combined.length <= limit && (
                                  <SlotExpandView
                                    posts={filteredPostsInSlot}
                                    oldPosts={oldInSlot}
                                    day={day}
                                    timeSlot={timeSlot}
                                    trigger={<div className="absolute inset-0 z-0" />}
                                  />
                                )}
                              </>
                            )
                          })()}
                        </div>

                        {/* Density badge for multi-post slots (Desktop only, subtle) */}
                        {!isMobile && (postsInSlot.length + oldInSlot.length) > 1 && (
                          <div className="absolute top-1 right-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-[#7C7EF4] ring-2 ring-white" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Month View
          <div className="relative lg:flex lg:flex-col lg:min-h-full">
            <div className="sticky top-0 z-10 bg-white/60 backdrop-blur-sm border-b border-[#E7E5F7]/40">
              <div className="grid grid-cols-7">
                {monthMatrix[0]?.map((day, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "text-center p-2 border-b border-[#E7E5F7]/40",
                      idx < 6 && "border-r border-[#E7E5F7]/40"
                    )}
                  >
                    <div className="text-xs text-[#5A5192]">{day.dayName}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={cn(
                isLoading ? "opacity-50 pointer-events-none" : "",
                "lg:flex lg:flex-1 lg:flex-col"
              )}
            >
              {monthMatrix.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 lg:flex-1">
                  {week.map((day, di) => {
                    const inMonth = isSameMonth(day.date, currentDate)
                    const oldForDay = uniqueById(getOldPostsForDay(day.date))
                    const oldIds = new Set(oldForDay.map((post) => post.id).filter(Boolean))
                    const posts = uniqueById(
                      getPostsForDay(day.date).filter((post) => {
                        if (!post.id) {
                          return true
                        }
                        return !oldIds.has(post.id)
                      }),
                    )
                    const isDragOver = dragOver?.day.date.getTime() === day.date.getTime() && !dragOver?.timeSlot
                    return (
                      <div
                        key={di}
                        className={cn(
                          "min-h-[120px] border-b border-[#E7E5F7]/30 p-2 align-top relative transition-colors duration-150",
                          di < 6 && "border-r border-[#E7E5F7]/30",
                          day.isToday ? "bg-[#F5F0FF]/50" : "bg-white/40",
                          !inMonth && "opacity-50",
                          isDragOver && "bg-[#7C7EF4]/20",
                          "flex flex-col"
                        )}
                        onDragOver={(e) => handleDragOver(e, day)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropMonth(e, day.date)}
                        aria-label={`${day.dayName} ${day.dayNumber}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={cn(
                            "text-xs font-bold px-1.5 py-0.5 rounded",
                            day.isToday ? "bg-[#301B69] text-white" : "text-slate-500"
                          )}>
                            {day.dayNumber}
                          </span>
                          {(posts.length + oldForDay.length) > 0 && (
                            <span className="text-[10px] font-bold text-[#7C7EF4] bg-[#F5F0FF] px-1.5 rounded-full">
                              {posts.length + oldForDay.length}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 flex flex-wrap gap-2 items-start justify-center overflow-hidden">
                          {(() => {
                            const combined = [...posts, ...oldForDay]
                            const limit = 3
                            const visible = combined.slice(0, limit)
                            const remaining = combined.length - limit

                            return (
                              <>
                                {visible.map((p) => {
                                  const isOld = oldForDay.some((ox) => ox.id === p.id)
                                  return (
                                    <CalendarPostChip
                                      key={p.id}
                                      post={p}
                                      onClick={() => (isOld ? selectPostForViewing(p) : handlePostClick(p))}
                                      onDragStart={isOld ? undefined : (e) =>
                                        e.dataTransfer.setData("application/json", JSON.stringify(p))
                                      }
                                    />
                                  )
                                })}
                                {remaining > 0 && (
                                  <SlotExpandView
                                    posts={posts as ScheduledPost[]}
                                    oldPosts={oldForDay as PostWithReel[]}
                                    day={day.date}
                                    trigger={
                                      <div className="flex items-center justify-center h-full aspect-[9/16] w-[45px] sm:w-[50px] md:w-[56px] border border-dashed border-[#7C7EF4]/60 rounded-md hover:bg-[#F5F0FF] transition-colors cursor-pointer group">
                                        <span className="text-[11px] font-bold text-[#7C7EF4]">+{remaining}</span>
                                      </div>
                                    }
                                  />
                                )}
                                {combined.length > 0 && combined.length <= limit && (
                                  <SlotExpandView
                                    posts={posts as ScheduledPost[]}
                                    oldPosts={oldForDay as PostWithReel[]}
                                    day={day.date}
                                    trigger={<div className="absolute inset-0 z-0" />}
                                  />
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Editorr */}
      {selectedPost && selectedVideo && (
        <PostEditor
          open={postEditorOpen}
          onOpenChange={(open) => {
            setPostEditorOpen(open)
            if (!open) {
              setEditorOrigin(null)
              setSelectedPostIsOld(false)
              if (selectedPost?.id?.toString().startsWith("temp-")) {
                setPosts((prev) => prev.filter((p) => p.id !== selectedPost.id))
                if (selectedPost?.id) delete pendingDraftRef.current[selectedPost.id]
              }
              setSelectedPost(null)
              setSelectedVideo(null)
            }
          }}
          originRect={editorOrigin}
          post={selectedPost}
          video={selectedVideo}
          selectedProfile={profile}
          onUpdate={handlePostUpdate}
          onDelete={handlePostDelete}
          isOld={selectedPostIsOld}
          onEnsurePost={ensurePostForEditor}
          onRequireProfile={() => {
            window.dispatchEvent(
              new CustomEvent("coachmark:add-account", { detail: { source: "post-editor" } })
            )
          }}
        />
      )}
    </div>
  )
}