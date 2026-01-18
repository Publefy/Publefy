"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Plus, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiServiceDefault } from "@/services/api/api-service";
import { axiosConfig, FULL_ENDPOINTS } from "@/services/api/apiConfig";
import type { Profile } from "@/types/profile";

/* ------------------------------ avatar cache ------------------------------ */
const avatarCache = new Map<string, { url: string; expires: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

const API_BASE_URL = (axiosConfig.baseURL || "").replace(/\/+$/, "");

function getCachedAvatar(key?: string) {
  if (!key) return null;
  const hit = avatarCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    try { URL.revokeObjectURL(hit.url); } catch {}
    avatarCache.delete(key);
    return null;
  }
  return hit.url;
}

function setCachedAvatar(key: string, url: string) {
  avatarCache.set(key, { url, expires: Date.now() + CACHE_TTL_MS });
}

if (typeof window !== "undefined") {
  // single global listener is fine at module scope
  window.addEventListener("ig:cleared", () => {
    for (const [, val] of avatarCache) {
      try { URL.revokeObjectURL(val.url); } catch {}
    }
    avatarCache.clear();
  });
}

/* ------------------------------ meta cache/hook ------------------------------ */
type ProfileMeta = { username?: string; name?: string; profile_picture_url?: string };
const metaCache = new Map<string, { meta: ProfileMeta; expires: number }>();

function getMetaCached(profileId?: string): ProfileMeta | null {
  if (!profileId) return null;
  const hit = metaCache.get(profileId);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    metaCache.delete(profileId);
    return null;
  }
  return hit.meta;
}

function setMetaCached(profileId: string, meta: ProfileMeta) {
  metaCache.set(profileId, { meta, expires: Date.now() + 15 * 60 * 1000 });
}

function profileCacheKey(profile?: Profile | null) {
  return profile?.ig_id || profile?.fb_id || profile?.id || undefined;
}

function normalizeProfileUrl(url?: string | null) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!API_BASE_URL) return url;
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function needsAuthHeader(url?: string) {
  if (!url) return false;
  return /\/(instagram|facebook)\/profile-picture\//i.test(url);
}

function resolveProfilePictureUrl(profile?: Profile | null, meta?: ProfileMeta | null) {
  const metaUrl = normalizeProfileUrl(meta?.profile_picture_url);
  if (metaUrl) return metaUrl;

  const imageUrl = normalizeProfileUrl(profile?.image);
  if (imageUrl) return imageUrl;

  if (profile?.platform === "facebook" && profile.fb_id) {
    return FULL_ENDPOINTS.facebook.profilePicture(profile.fb_id);
  }
  if (profile?.platform === "instagram" && profile.ig_id) {
    return FULL_ENDPOINTS.instagram.profilePicture(profile.ig_id);
  }
  return "";
}

function useBrowserToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("userToken"));
    }
  }, []);
  return token;
}

function useProfileMeta(profile: Profile | null) {
  const token = useBrowserToken();
  const profileId = profile?.id;
  const [meta, setMeta] = useState<ProfileMeta | null>(() => getMetaCached(profileId));
  const [loading, setLoading] = useState<boolean>(!getMetaCached(profileId) && !!profileId);

  useEffect(() => {
    let cancelled = false;
    if (!profile || !token) {
      setMeta(null);
      setLoading(false);
      return;
    }

    const cached = getMetaCached(profileId);
    if (cached) {
      setMeta(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);

        let url: string | null = null;
        if (profile.platform === "facebook" && profile.fb_id) {
          url = FULL_ENDPOINTS.facebook.profilePicture(profile.fb_id, true);
        } else if (profile.platform === "instagram" && profile.ig_id) {
          url = FULL_ENDPOINTS.instagram.profilePicture(profile.ig_id, true);
        } else {
          setMeta({
            name: profile.name,
            username: profile.username,
            profile_picture_url: normalizeProfileUrl(profile.image),
          });
          setLoading(false);
          return;
        }

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`meta ${profileId} -> ${res.status}`);
        const json = (await res.json()) as ProfileMeta;
        if (!cancelled) {
          const normalizedMeta = {
            ...json,
            profile_picture_url: normalizeProfileUrl(json.profile_picture_url),
          };
          setMeta(normalizedMeta);
          if (profileId) {
            setMetaCached(profileId, normalizedMeta);
          }
        }
      } catch {
        if (!cancelled) {
          setMeta({
            name: profile.name,
            username: profile.username,
            profile_picture_url: normalizeProfileUrl(profile.image),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile, token]);

  return { meta, loading };
}

// Оставляем старый хук для обратной совместимости
function useIgMeta(igId?: string) {
  const token = useBrowserToken();
  const [meta, setMeta] = useState<ProfileMeta | null>(() => getMetaCached(igId));
  const [loading, setLoading] = useState<boolean>(!getMetaCached(igId) && !!igId);

  useEffect(() => {
    let cancelled = false;
    if (!igId || !token) {
      setMeta(null);
      setLoading(false);
      return;
    }

    const cached = getMetaCached(igId);
    if (cached) {
      setMeta(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const url = FULL_ENDPOINTS.instagram.profilePicture(igId, true);
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`meta ${igId} -> ${res.status}`);
        const json = (await res.json()) as ProfileMeta;
        if (!cancelled) {
          const normalizedMeta = {
            ...json,
            profile_picture_url: normalizeProfileUrl(json.profile_picture_url),
          };
          setMeta(normalizedMeta);
          setMetaCached(igId, normalizedMeta);
        }
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [igId, token]);

  return { meta, loading };
}

/* ------------------------------ avatar image ------------------------------ */
function AuthAvatarImage({
  profile,
  alt,
  className,
}: {
  profile?: Profile | null;
  alt: string;
  className?: string;
}) {
  const token = useBrowserToken();
  const { meta } = useProfileMeta(profile ?? null);
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const cacheKey = profileCacheKey(profile);

    async function load() {
      if (!profile) {
        setSrc(undefined);
        return;
      }

      const resolvedUrl = resolveProfilePictureUrl(profile, meta);
      const normalizedUrl = normalizeProfileUrl(resolvedUrl);

      if (!normalizedUrl) {
        setSrc(undefined);
        return;
      }

      if (!needsAuthHeader(normalizedUrl)) {
        setSrc(normalizedUrl);
        return;
      }

      const cached = getCachedAvatar(cacheKey);
      if (cached) {
        setSrc(cached);
        return;
      }

      if (!token) {
        setSrc(undefined);
        return;
      }

      try {
        const res = await fetch(normalizedUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "image/*",
          },
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`avatar ${cacheKey || normalizedUrl} -> ${res.status}`);

        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        if (cacheKey) setCachedAvatar(cacheKey, objUrl);
        if (!cancelled) setSrc(objUrl);
      } catch (err: any) {
        if (err?.name !== "AbortError" && !cancelled) {
          setSrc(undefined);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [profile, token, meta?.profile_picture_url]);

  return (
    <AvatarImage
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setSrc(undefined)}
      referrerPolicy="no-referrer"
    />
  );
}

export { AuthAvatarImage };

/* ------------------------------ helpers ------------------------------ */
function initialsFrom(meta?: ProfileMeta, profile?: Profile | null) {
  const name = meta?.name || profile?.name || meta?.username || profile?.username || "?";
  return name.trim().charAt(0).toUpperCase() || "?";
}

/* ------------------------------ row component (safe hooks) ------------------------------ */
function ProfileItem({
  profile,
  selected,
  onSelect,
  onRemove,
}: {
  profile: Profile;
  selected: boolean;
  onSelect: (p: Profile) => void;
  onRemove: (p: Profile, e: React.MouseEvent) => void;
}) {
  const { meta } = useProfileMeta(profile);

  const displayName = meta?.name || profile.name || profile.platform;
  const displayUsername = meta?.username || profile.username;

  return (
    <div
      className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded cursor-pointer group"
      onClick={() => onSelect(profile)}
    >
      <div
        className={cn(
          "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
          selected ? "bg-blue-500 border-blue-500" : "border-gray-300"
        )}
      >
        {selected && <Check className="h-3 w-3 text-white" />}
      </div>

      <Avatar className="h-6 w-6 shrink-0">
        <AuthAvatarImage 
          profile={profile} 
          alt={displayUsername || profile.platform} 
          className="h-6 w-6" 
        />
        <AvatarFallback className="bg-gray-200 text-[10px] font-medium">
          {initialsFrom(meta ?? undefined, profile)}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm leading-tight truncate">{displayName}</span>
        {displayUsername && (
          <span className="text-xs text-muted-foreground truncate">@{displayUsername}</span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:text-red-500 hover:bg-red-50"
        onClick={(e) => onRemove(profile, e)}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

/* ------------------------------ main component ------------------------------ */
interface ProfileSelectorProps {
  onProfileSelect: (selectedProfile: Profile | null) => void;
  selectedProfile: Profile | null;
  availableProfiles: Profile[];
  reloadProfiles: () => void;
  highlight?: boolean;
}

export default function ProfileSelector({
  availableProfiles,
  onProfileSelect,
  selectedProfile,
  reloadProfiles,
  highlight,
}: ProfileSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
 
  const { meta: selectedMeta } = useProfileMeta(selectedProfile);
 
  // Open on external request (coachmark CTA)
  useEffect(() => {
    const onOpenReq = () => setOpen(true);
    if (typeof window !== "undefined") {
      window.addEventListener("profileSelector:open", onOpenReq);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("profileSelector:open", onOpenReq);
      }
    };
  }, []);

  useEffect(() => {
    const savedId =
      typeof window !== "undefined" ? localStorage.getItem("selectedProfileId") : null;
    if (!savedId) return;
    if (selectedProfile?.id === savedId) return;

    const match = availableProfiles.find((p) => p.id === savedId);
    if (match) {
      onProfileSelect(match);
      if (match.ig_id) {
        if (typeof window !== "undefined") {
          localStorage.setItem("selectedProfileIgId", match.ig_id);
        }
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ig:selected", {
            detail: { igId: match.ig_id, profileId: match.id, profile: match },
          })
        );
      }
    } else {
      if (typeof window !== "undefined") {
        localStorage.removeItem("selectedProfileId");
        localStorage.removeItem("selectedProfileIgId");
        window.dispatchEvent(new CustomEvent("ig:cleared"));
      }
      if (selectedProfile) onProfileSelect(null);
    }
  }, [availableProfiles, onProfileSelect, selectedProfile?.id]);

  const handleSelect = useCallback(
    (profile: Profile) => {
      if (selectedProfile?.id === profile.id) {
        setOpen(false);
        return;
      }
      onProfileSelect(profile);
      if (typeof window !== "undefined") {
        if (profile?.id) localStorage.setItem("selectedProfileId", profile.id);
        if (profile?.ig_id) localStorage.setItem("selectedProfileIgId", profile.ig_id);
        window.dispatchEvent(
          new CustomEvent("ig:selected", {
            detail: { igId: profile.ig_id, profileId: profile.id, profile },
          })
        );
      }
      setOpen(false);
    },
    [onProfileSelect, selectedProfile?.id]
  );

  const handleAddAccount = useCallback(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("userToken");
    if (!token) {
      alert("You must be logged in to add an account.");
      return;
    }
    // Default to Instagram account
    window.location.href = `${(axiosConfig.baseURL || "").replace(
      /\/$/,
      ""
    )}/instagram/login?state=${encodeURIComponent(token)}`;
  }, []);

  const handleRemoveAccount = useCallback(async (profile: Profile, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    setIsLoading(true);
    try {
      // Определяем endpoint в зависимости от платформы
      if (profile.platform === 'facebook' && profile.fb_id) {
        await apiServiceDefault.post("facebook/logout/", { fb_id: profile.fb_id });
      } else if (profile.platform === 'instagram' && profile.ig_id) {
        await apiServiceDefault.post("instagram/logout/", { ig_id: profile.ig_id });
      }
      
      // If the removed profile was the selected one, clear it
      if (selectedProfile?.id === profile.id) {
        onProfileSelect(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("selectedProfileId");
          localStorage.removeItem("selectedProfileIgId");
          window.dispatchEvent(new CustomEvent("ig:cleared"));
        }
      }
      
      await reloadProfiles();
    } catch (error) {
      console.error("Failed to logout:", error);
      alert("Failed to disconnect account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [reloadProfiles, onProfileSelect, selectedProfile]);

  const hasInstagram = availableProfiles.some(p => p.platform === 'instagram');

  return (
    <div className="flex items-center gap-4">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="profile-select-trigger"
            variant="outline"
            className={cn(
              "flex items-center gap-2 rounded-full",
              "bg-white/30 backdrop-blur-sm border border-white/40",
              "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
              "hover:bg-white/40 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12)]",
              "transition-all duration-200 active:scale-[0.98]",
              highlight ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white relative z-[10000]" : ""
            )}
          >
            {selectedProfile ? (
              <>
                <Avatar className="h-6 w-6 mr-1">
                  <AuthAvatarImage
                    profile={selectedProfile}
                    alt={selectedMeta?.username || selectedProfile.platform}
                    className="h-6 w-6"
                  />
                  <AvatarFallback className="bg-gray-200 text-[10px] font-medium">
                    {initialsFrom(selectedMeta ?? undefined, selectedProfile)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left truncate max-w-[160px]">
                  <span className="truncate">
                    {selectedMeta?.name || selectedProfile.name || selectedProfile.platform}
                  </span>
                  {(selectedMeta?.username || selectedProfile.username) && (
                    <span className="text-xs text-muted-foreground truncate">
                      @{selectedMeta?.username || selectedProfile.username}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <User className="h-4 w-4 mr-1" />
                Select Profile
              </>
            )}
            <ChevronDown className="h-4 w-4 ml-auto" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[280px] p-2">
          {isLoading ? (
            <div className="flex justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="space-y-2">
              {availableProfiles.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No profiles yet.</div>
              ) : (
                availableProfiles.map((profile) => (
                  <ProfileItem
                    key={profile.id}
                    profile={profile}
                    selected={selectedProfile?.id === profile.id}
                    onSelect={handleSelect}
                    onRemove={handleRemoveAccount}
                  />
                ))
              )}

              {!hasInstagram && (
                <div className="pt-2 mt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-blue-500"
                    onClick={handleAddAccount}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
