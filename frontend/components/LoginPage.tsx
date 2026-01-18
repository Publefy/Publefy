"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { apiServiceDefault } from "@/services/api/api-service";
import { axiosConfig } from "@/services/api/apiConfig";
import { googleAuthService } from "@/services/api/google-auth-service";
import { AnimatePresence, motion } from "framer-motion";
import { saveAuthMethod } from "@/utils/auth-method";
import Link from "next/link";

/* -----------------------------------------
   Config (use the same origin as your Axios client)
------------------------------------------ */
const API_ORIGIN = axiosConfig.baseURL || "";
const OAUTH_REDIRECT_PATH = "/"; // where backend will send users back

// Helper for form-data
function toFormData(obj: Record<string, any>): FormData {
  const form = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      form.append(key, value as any);
    }
  });
  return form;
}

const LOGIN_ERROR_KEYS = [
  "errors",
  "detail",
  "details",
  "message",
  "msg",
  "error",
  "error_message",
  "errorMessage",
  "error_description",
  "description",
  "reason",
  "title",
  "statusText",
  "error_detail",
  "errorDetails",
  "validationErrors",
] as const;

const LOGIN_ERROR_FALLBACK = "Authentication failed. Please try again.";
const STATUS_CODE_MESSAGE = /^(request failed with status code \d+|http error! status: \d+)$/i;
const UNAUTHORIZED_FALLBACK = "Incorrect email or password. Please try again.";
const HTML_SNIPPET = /<!doctype html|<html|<body|<head|<\/[a-z]+>/i;
const STATUS_SPECIFIC_MESSAGES: Record<number, string> = {
  400: "Invalid request. Please review your input and try again.",
  401: UNAUTHORIZED_FALLBACK,
  403: "Access denied. Please contact support if this is unexpected.",
  404: "Login service is unavailable. Please try again shortly.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Server error. Please try again in a moment.",
  502: "Upstream server error. Please try again shortly.",
  503: "Service temporarily unavailable. Please try again shortly.",
  504: "Login request timed out. Please try again.",
};

const isMeaningfulErrorString = (value: string | null | undefined): value is string => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !/^\d+$/.test(trimmed);
};

const gatherLoginErrorMessages = (value: unknown): string[] => {
  if (value == null) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return gatherLoginErrorMessages(parsed);
    } catch {
      return [value];
    }
  }
  if (typeof value === "number") return [value.toString()];
  if (Array.isArray(value)) {
    return value.reduce<string[]>((acc, item) => acc.concat(gatherLoginErrorMessages(item)), []);
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const fromKnownKeys = LOGIN_ERROR_KEYS.reduce<string[]>((acc, key) => {
      if (key in obj) {
        return acc.concat(gatherLoginErrorMessages(obj[key]));
      }
      return acc;
    }, []);
    if (fromKnownKeys.length > 0) return fromKnownKeys;
    return Object.values(obj).reduce<string[]>((acc, item) => acc.concat(gatherLoginErrorMessages(item)), []);
  }
  return [];
};

const getLoginErrorMessage = (error: unknown): string => {
  const axiosError = error as {
    response?: { data?: unknown; status?: number; statusText?: string };
    request?: unknown;
    code?: string;
    message?: string;
  };
  const status = axiosError?.response?.status;
  const preferStatusMessage = (): string | undefined => {
    if (status && STATUS_SPECIFIC_MESSAGES[status]) return STATUS_SPECIFIC_MESSAGES[status];
    if (status && status >= 500) return "Server is having trouble right now. Please try again soon.";
    return undefined;
  };
  const sanitizeMessage = (value: string | undefined): string | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (HTML_SNIPPET.test(trimmed)) return preferStatusMessage();
    if (isMeaningfulErrorString(trimmed) && !STATUS_CODE_MESSAGE.test(trimmed)) return trimmed;
    return undefined;
  };
  const candidates = gatherLoginErrorMessages(axiosError?.response?.data);
  const messageFromData = candidates.find(
    (candidate) => isMeaningfulErrorString(candidate) && !STATUS_CODE_MESSAGE.test(candidate.trim())
  );
  const sanitizedData = sanitizeMessage(messageFromData?.trim());
  if (sanitizedData) return sanitizedData;
  const statusText = axiosError?.response?.statusText;
  const sanitizedStatusText = sanitizeMessage(statusText?.trim());
  if (sanitizedStatusText) return sanitizedStatusText;
  const genericMessage = axiosError?.message;
  const sanitizedGeneric = sanitizeMessage(genericMessage?.trim());
  if (sanitizedGeneric) return sanitizedGeneric;
  if (axiosError?.code === "ERR_NETWORK" || (!axiosError?.response && axiosError?.request)) {
    return "Network error. Please check your connection and try again.";
  }
  const byStatus = preferStatusMessage();
  if (byStatus) return byStatus;
  return LOGIN_ERROR_FALLBACK;
};

/* -----------------------------------------
   Brand icons (inline SVGs)
------------------------------------------ */
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 31.9 29.3 35 24 35c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C33.8 5 29.2 3 24 3 16 3 9.2 7.6 6.3 14.7z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16.3 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C33.8 5 29.2 3 24 3 16 3 9.2 7.6 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 45c5.1 0 9.8-1.9 13.3-5.1l-6.1-5c-2.1 1.5-4.7 2.4-7.2 2.4-5.2 0-9.6-3.2-11.2-7.7l-6.5 5C9.1 40.3 16 45 24 45z"/>
      <path fill="#1976D2" d="M45 24c0-1.4-.1-2.4-.4-3.5H24v8h11.3c-.6 3-2.4 5.4-4.9 7.2l6.1 5C40.7 37.4 45 31.4 45 24z"/>
    </svg>
  );
}


function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5A5.5 5.5 0 1 1 6.5 13 5.5 5.5 0 0 1 12 7.5Zm0 2A3.5 3.5 0 1 0 15.5 13 3.5 3.5 0 0 0 12 9.5Zm5.8-3.3a1.2 1.2 0 1 1-1.7 1.7 1.2 1.2 0 0 1 1.7-1.7Z" />
    </svg>
  );
}

export default function LoginPage({ onLogin }: { onLogin?: () => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreeToTerms, setAgreeToTerms] = useState(true);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);
  const [formData, setFormData] = useState({
    phoneNumber: "",
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* -----------------------------------------
     Handle OAuth callback via URL params/hash
  ------------------------------------------ */
  useEffect(() => {
    // Обрабатываем Google OAuth callback
    const handleGoogleCallback = async () => {
      const callbackParams = googleAuthService.checkForGoogleCallback();
      
      if (callbackParams) {
        try {
          console.log('🔄 Обрабатываем Google OAuth callback...');
          const response = await googleAuthService.handleGoogleCallback(
            callbackParams.code,
            callbackParams.state
          );

          if (response.success && response.token) {
            // Сохраняем токен
            googleAuthService.saveToken(response.token);
            
            // Очищаем URL от параметров OAuth
            googleAuthService.clearOAuthParams();
            
            // Остаемся в приложении (на главной)
            window.location.href = '/';
          } else {
            setError(response.message || 'Ошибка аутентификации через Google');
          }
        } catch (error: any) {
          console.error('❌ Ошибка при обработке Google OAuth callback:', error);
          setError(error.message || 'Произошла ошибка при входе через Google');
        }
      }
    };

    handleGoogleCallback();
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      let token = url.searchParams.get("access_token");
      let userParam = url.searchParams.get("user");

      // also support hash fragment (#access_token=...&user=...)
      if (!token && window.location.hash) {
        const hash = new URLSearchParams(window.location.hash.substring(1));
        token = hash.get("access_token") || token;
        userParam = hash.get("user") || userParam;
      }

      if (token) {
        let user: any = null;
        if (userParam) {
          try {
            user = JSON.parse(userParam);
          } catch {
            try {
              const decoded = atob(userParam);
              user = JSON.parse(decoded);
            } catch {}
          }
        }

        document.cookie = `userToken=${token}; Path=/; Max-Age=604800; Secure; SameSite=Strict`;
        localStorage.setItem("userToken", token);
        if (user) localStorage.setItem("user", JSON.stringify(user));

        // Clean the URL (both query and hash)
        url.searchParams.delete("access_token");
        url.searchParams.delete("user");
        window.history.replaceState({}, "", url.pathname + url.search);

        if (window.location.hash) {
          window.history.replaceState({}, "", url.pathname + url.search);
        }

        onLogin && onLogin();
      }
    } catch {
      /* ignore */
    }
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!formData.email || !formData.password) {
      setError("Email and password are required.");
      setIsLoading(false);
      return;
    }
    if (isSignUp && formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }
    if (isSignUp && !agreeToTerms) {
      setError("You must agree to the Terms of use and Privacy Policy.");
      setIsLoading(false);
      return;
    }

    try {
      let res;
      if (!isSignUp) {
        const data = toFormData({ username: formData.email, password: formData.password });
        res = await apiServiceDefault.post<{ access_token: string; user: any }>("/auth/login", data);
      } else {
        const data = toFormData({
          name: formData.name || formData.email.split("@")[0],
          email: formData.email,
          password: formData.password,
        });
        res = await apiServiceDefault.post<{ access_token: string; user: any }>("/auth/register", data);
      }

      if (res?.access_token) {
        document.cookie = `userToken=${res.access_token}; Path=/; Max-Age=604800; Secure; SameSite=Strict`;
        localStorage.setItem("userToken", res.access_token);
        localStorage.setItem("user", JSON.stringify(res.user));
        saveAuthMethod('email');
        onLogin && onLogin();
      } else {
        setError("Authentication failed. Please check your credentials.");
      }
    } catch (error: any) {
      setError(getLoginErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  /* -----------------------------------------
     Social OAuth (full-page redirects)
  ------------------------------------------ */
  const redirectToOAuth = (endpoint: string, returnPath: string = "/") => {
    const redirectUri = `${window.location.origin}${returnPath}`;
    const url = `${endpoint}?redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = url;
  };


  const handleGoogle = async () => {
    setError(null);
    try {
      googleAuthService.setBaseUrl(API_ORIGIN || 'https://publefy-1020068343725.us-central1.run.app/');
      await googleAuthService.initiateGoogleAuthAndRedirect();
    } catch (error: any) {
      console.error('❌ Ошибка Google OAuth в LoginPage:', error);
      
      let errorMessage = error.message || 'Ошибка при входе через Google';
      
      if (error.message.includes('Сервер недоступен')) {
        errorMessage = 'API сервер недоступен. Попробуйте позже.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
      }
      
      setError(errorMessage);
    }
  };

  const handleInstagram = () => {
    setError(null);
    // Instagram OAuth implementation would go here
    // For now, just show an error
    setError("Instagram login is coming soon.");
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#E8F4FF] via-[#F0E8FF] to-[#E8F4FF]">
      {/* Decorative arc lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg className="absolute top-1/4 left-0 w-full opacity-20" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path
            d="M0,100 Q300,50 600,100 T1200,100"
            stroke="white"
            strokeWidth="2"
            fill="none"
            className="drop-shadow-sm"
          />
        </svg>
        <svg className="absolute top-1/3 right-0 w-full opacity-15" viewBox="0 0 1200 200" preserveAspectRatio="none">
          <path
            d="M0,120 Q400,80 800,120 T1200,120"
            stroke="white"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>

      {/* Cloud shapes at bottom */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
        <img
          src="/Cloud_left.svg"
          alt=""
          className="absolute bottom-0 left-0 opacity-30 w-[300px] h-auto"
          aria-hidden="true"
        />
        <img
          src="/Cloud_bottom_right.svg"
          alt=""
          className="absolute bottom-0 right-0 opacity-25 w-[400px] h-auto"
          aria-hidden="true"
        />
      </div>

      {/* Logo in top-left */}
      <div className="absolute top-6 left-6 z-10">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-marker.png"
            alt="Publefy"
            width={121}
            height={50}
            priority
            className="h-10 w-auto"
          />
        </Link>
      </div>

      {/* Main content - centered card */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12 sm:py-16">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isSignUp ? "signup" : "login"}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-[480px]"
          >
            {/* Sign-up card */}
            <div className="relative rounded-[32px] bg-gradient-to-br from-[#FFF5F9] via-[#F8F0FF] to-[#FFF5F9] border border-white/60 shadow-[0_20px_60px_rgba(48,27,105,0.15)] p-8 sm:p-10">
              {/* Card heading */}
              <div className="text-center mb-8">
                <h1 className="text-[32px] sm:text-[36px] font-bold text-[#1B0D3F] mb-2">
                  {isSignUp ? "Sign up" : "Sign in"}
                </h1>
                <p className="text-sm sm:text-base text-[#5A5192]/80">
                  {isSignUp
                    ? "Sign up for free to access to in any of our products"
                    : "Welcome back! Sign in to continue"}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-[#2A2550] mb-1.5 block">
                      Username
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your username"
                      className="h-12 rounded-xl border-[#E7E5F7] bg-white/80 text-[#2A2550] placeholder:text-[#8B90AA] focus:border-[#7C7EF4] focus:ring-2 focus:ring-[#7C7EF4]/20"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-[#2A2550] mb-1.5 block">
                    Email address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    className="h-12 rounded-xl border-[#E7E5F7] bg-white/80 text-[#2A2550] placeholder:text-[#8B90AA] focus:border-[#7C7EF4] focus:ring-2 focus:ring-[#7C7EF4]/20"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    required
                    inputMode="email"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="password" className="text-sm font-medium text-[#2A2550]">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="flex items-center gap-1.5 text-xs text-[#7C7EF4] hover:text-[#6E6FF2] transition-colors"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="h-4 w-4" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="h-12 rounded-xl border-[#E7E5F7] bg-white/80 text-[#2A2550] placeholder:text-[#8B90AA] focus:border-[#7C7EF4] focus:ring-2 focus:ring-[#7C7EF4]/20"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                  />
                  {isSignUp && (
                    <p className="mt-1.5 text-xs text-[#8B90AA]">
                      Use 8 or more characters with a mix of letters, numbers & symbols
                    </p>
                  )}
                </div>

                {isSignUp && (
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#2A2550] mb-1.5 block">
                      Confirm Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter your password"
                        className="h-12 rounded-xl border-[#E7E5F7] bg-white/80 text-[#2A2550] placeholder:text-[#8B90AA] focus:border-[#7C7EF4] focus:ring-2 focus:ring-[#7C7EF4]/20"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                        required={isSignUp}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-[#8B90AA]" />
                        ) : (
                          <Eye className="h-4 w-4 text-[#8B90AA]" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Checkboxes - only show on sign up */}
                {isSignUp && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={agreeToTerms}
                        onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                        className="mt-0.5 border-[#E7E5F7] data-[state=checked]:bg-[#7C7EF4] data-[state=checked]:border-[#7C7EF4]"
                      />
                      <label
                        htmlFor="terms"
                        className="text-sm text-[#5A5192] leading-relaxed cursor-pointer"
                      >
                        Agree to our{" "}
                        <Link href="/terms" className="text-[#7C7EF4] underline underline-offset-2 hover:text-[#6E6FF2]">
                          Terms of use
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" className="text-[#7C7EF4] underline underline-offset-2 hover:text-[#6E6FF2]">
                          Privacy Policy
                        </Link>
                      </label>
                    </div>
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="newsletter"
                        checked={subscribeNewsletter}
                        onCheckedChange={(checked) => setSubscribeNewsletter(checked === true)}
                        className="mt-0.5 border-[#E7E5F7] data-[state=checked]:bg-[#7C7EF4] data-[state=checked]:border-[#7C7EF4]"
                      />
                      <label
                        htmlFor="newsletter"
                        className="text-sm text-[#5A5192] leading-relaxed cursor-pointer"
                      >
                        Subscribe to our monthly newsletter
                      </label>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="text-red-600 bg-red-50 rounded-xl p-3 text-sm text-center border border-red-200">
                    {error}
                  </div>
                )}

                {/* Sign up button */}
                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[#5E46D8] to-[#7C7EF4] hover:from-[#4E36C8] hover:to-[#6E6FF2] text-white font-semibold text-base shadow-[0_8px_24px_rgba(94,70,216,0.35)] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {isSignUp ? "Creating Account..." : "Signing In..."}
                    </div>
                  ) : isSignUp ? (
                    "Sign up"
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>

              {/* Already have account / Don't have account */}
              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => setIsSignUp((s) => !s)}
                  className="text-sm text-[#5A5192] hover:text-[#7C7EF4] transition-colors"
                >
                  {isSignUp ? (
                    <>
                      Already have an account?{" "}
                      <span className="text-[#7C7EF4] underline underline-offset-2 font-medium">Log in</span>
                    </>
                  ) : (
                    <>
                      Don't have an account?{" "}
                      <span className="text-[#7C7EF4] underline underline-offset-2 font-medium">Sign up</span>
                    </>
                  )}
                </button>
              </div>

              {/* Social sign-in buttons */}
              <div className="mt-8 pt-8 border-t border-[#E7E5F7]">
                <div className="flex justify-center">
                  <button
                    type="button"
t                    onClick={handleGoogle}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-4 h-12 w-full max-w-[400px] rounded-full bg-white hover:bg-slate-50 text-[#2A2550] font-semibold text-base border border-[#E7E5F7] shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed px-6"
                    aria-label="Sign in with Google"
                  >
                    <GoogleIcon className="h-5 w-5" />
                    <span className="text-[15px] font-semibold">Sign in with Google</span>
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
