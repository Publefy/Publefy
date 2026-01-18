// services/api/apiConfig.ts
import axios, { CreateAxiosDefaults } from "axios";

/** Normalize base URL (strip trailing slashes) */
const DEFAULT_CLOUD_RUN_BASE =
  "https://publefy-339761699392.europe-west1.run.app";

const extractHostname = (value?: string) => {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.hostname;
  } catch {
    const trimmed = value.trim();
    const match = trimmed.match(/^https?:\/\/([^/]+)/i);
    return match ? match[1] : "";
  }
};

const isPublefyDotCom = (value?: string) => {
  const host = extractHostname(value).toLowerCase();
  return host === "publefy.com";
};

const resolveEnvUrl = (value: string | undefined, fallback: string) => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return isPublefyDotCom(trimmed) ? fallback : trimmed;
};

const RAW_BASE = resolveEnvUrl(process.env.NEXT_PUBLIC_API_URL, DEFAULT_CLOUD_RUN_BASE);
export const API_BASE = RAW_BASE.replace(/\/+$/, ""); // e.g. "https://api.example.com"
const RAW_MEDIA_BASE = resolveEnvUrl(
  process.env.NEXT_PUBLIC_MEDIA_URL,
  DEFAULT_CLOUD_RUN_BASE
);
export const MEDIA_BASE = RAW_MEDIA_BASE.replace(/\/+$/, "") || API_BASE;
export const CLOUD_RUN_BASE = DEFAULT_CLOUD_RUN_BASE;

/** Axios config used by your ApiService */
export const axiosConfig: CreateAxiosDefaults = {
  baseURL: API_BASE || undefined,
  timeout: 30000,
  headers: { Accept: "application/json" },
};

/** Ensure endpoints always have a leading slash (and allow absolute URLs unchanged) */
const ensureLeadingSlash = (p?: string) => {
  if (!p) return "/";
  if (/^https?:\/\//i.test(p)) return p; // already absolute URL
  return p.startsWith("/") ? p : `/${p}`;
};

/** Relative endpoints (from env), normalized to start with "/" */
export const API_ENDPOINTS = {
  auth: {
    login: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_AUTH_LOGIN || "/auth/login"),
    register: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_AUTH_REGISTER || "/auth/register"),
    google: {
      login: ensureLeadingSlash(
        process.env.NEXT_PUBLIC_API_AUTH_GOOGLE_LOGIN || "/auth/google/login/"
      ),
      callback: ensureLeadingSlash(
        process.env.NEXT_PUBLIC_API_AUTH_GOOGLE_CALLBACK || "/auth/google/callback/"
      ),
    },
  },
  instagram: {
    profilePicture: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_INSTAGRAM_PROFILE_PICTURE || "/instagram/profile-picture"),
    logout: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_INSTAGRAM_LOGOUT || "/auth/instagram/logout"),
    login: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_INSTAGRAM_LOGIN || "/auth/instagram/login"),
  },
  facebook: {
    profilePicture: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_FACEBOOK_PROFILE_PICTURE || "/facebook/profile-picture"),
    logout: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_FACEBOOK_LOGOUT || "/auth/facebook/logout"),
    login: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_FACEBOOK_LOGIN || "/auth/facebook/login"),
  },
  video: {
    analyze: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_VIDEO_ANALYZE || "/video/analyze"),
    finalize: ensureLeadingSlash(process.env.NEXT_PUBLIC_API_VIDEO_FINALIZE || "/video/finalize"),
  },
} as const;

/**
 * Absolute URLs (already joined with API_BASE).
 * Use these for full-page redirects, <img src>, etc.
 * For axios calls, you can keep using API_ENDPOINTS with axios baseURL.
 */
export const FULL_ENDPOINTS = {
  auth: {
    login: `${API_BASE}${API_ENDPOINTS.auth.login}`,
    register: `${API_BASE}${API_ENDPOINTS.auth.register}`,
    google: {
      login: `${API_BASE}${API_ENDPOINTS.auth.google.login}`,
      callback: `${API_BASE}${API_ENDPOINTS.auth.google.callback}`,
    },
  },
  instagram: { 
    profilePicture: (igId: string, meta?: boolean) =>
      `${API_BASE}${API_ENDPOINTS.instagram.profilePicture}/${igId}${meta ? "?meta=1" : ""}`,
    logout: `${API_BASE}${API_ENDPOINTS.instagram.logout}`,
    login: (state: string) =>
      `${API_BASE}${API_ENDPOINTS.instagram.login}?state=${encodeURIComponent(state)}`,
  },
  facebook: { 
    profilePicture: (fbId: string, meta?: boolean) =>
      `${API_BASE}${API_ENDPOINTS.facebook.profilePicture}/${fbId}${meta ? "?meta=1" : ""}`,
    logout: `${API_BASE}${API_ENDPOINTS.facebook.logout}`,
    login: (state: string) =>
      `${API_BASE}${API_ENDPOINTS.facebook.login}?state=${encodeURIComponent(state)}`,
  },
  video: {
    analyze: `${API_BASE}${API_ENDPOINTS.video.analyze}`,
    finalize: `${API_BASE}${API_ENDPOINTS.video.finalize}`,
  },
} as const;
 
export const axiosInstance = axios.create(axiosConfig);

/**
 * Absolute URL override specifically for video analyze endpoint.
 * If NEXT_PUBLIC_VIDEO_ANALYZE_URL is provided, it will be used.
 * Otherwise falls back to the Cloud Run default requested by product.
 */
export const VIDEO_ANALYZE_URL =
  process.env.NEXT_PUBLIC_VIDEO_ANALYZE_URL ||
  `${CLOUD_RUN_BASE}/video/analyze/`;
