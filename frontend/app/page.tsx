"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";
import LandingPage from "@/components/LandingPage";
import { googleAuthService } from "@/services/api/google-auth-service";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600" />
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // 1. Initial auth check and token extraction
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const url = new URL(window.location.href);
        let token = url.searchParams.get("access_token");
        let userParam = url.searchParams.get("user");

        // Try hash if not in query
        if (!token && window.location.hash) {
          const hash = new URLSearchParams(window.location.hash.substring(1));
          token = hash.get("access_token") || token;
          userParam = hash.get("user") || userParam;
        }

        if (token) {
          // Save new token
          document.cookie = `userToken=${token}; Path=/; Max-Age=604800; Secure; SameSite=Strict`;
          localStorage.setItem("userToken", token);

          if (userParam) {
            try {
              localStorage.setItem("user", JSON.stringify(JSON.parse(userParam)));
            } catch {
              try {
                const decoded = atob(userParam);
                localStorage.setItem("user", JSON.stringify(JSON.parse(decoded)));
              } catch { }
            }
          }

          // Clean URL
          url.searchParams.delete("access_token");
          url.searchParams.delete("user");
          window.history.replaceState({}, "", url.pathname + url.search);

          setIsAuthenticated(true);
          return;
        }

        // No new token in URL, check existing session
        const existingToken = localStorage.getItem("userToken") || getCookie("userToken");
        setIsAuthenticated(!!existingToken);
      } catch (err) {
        console.error("Auth initialization failed:", err);
        setIsAuthenticated(false);
      }
    };

    initializeAuth();
  }, []);

  function getCookie(name: string) {
    if (typeof document === "undefined") return null;
    const v = document.cookie.match("(^|;) ?" + name + "=([^;]*)(;|$)");
    return v ? v[2] : null;
  }

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600" />
      </div>
    );
  }

  const forceLogin = searchParams?.get("auth") === "login";

  if (!isAuthenticated) {
    if (forceLogin) {
      return (
        <LoginPage
          onLogin={() => {
            setIsAuthenticated(true);
            // clear the query param
            const entries = Array.from(searchParams?.entries?.() ?? []);
            const params = new URLSearchParams(entries);
            params.delete("auth");
            router.replace("/" + (params.toString() ? `?${params.toString()}` : ""));
            try {
              // Mark that we should auto-open processor after login if resume flag set
              if (typeof window !== "undefined") {
                const hasResume = sessionStorage.getItem("resumeVideoProcessor");
                if (hasResume) sessionStorage.setItem("resumeVideoProcessorOpen", "1");
              }
            } catch { }
          }}
        />
      );
    }
    return <LandingPage />;
  }

  return (
    <Dashboard
      onDashboardLogout={() => {
        localStorage.removeItem("userToken");
        localStorage.removeItem("user");
        localStorage.removeItem("authMethod");
        try {
          localStorage.removeItem("resumeVideoProcessorState");
          sessionStorage.removeItem("resumeVideoProcessor");
          sessionStorage.removeItem("resumeVideoProcessorOpen");
          sessionStorage.removeItem("resumeVideoProcessorState");
          sessionStorage.removeItem("resumeModalDone");
          // best-effort clear in-memory file
          if (typeof window !== "undefined") {
            try { (window as any).__videoProcessorResume = undefined; } catch { }
          }
        } catch { }
        document.cookie =
          "userToken=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;";
        setIsAuthenticated(false);
        router.replace("/");
      }}
    />
  );
}
