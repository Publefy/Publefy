"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import LoginPage from "@/components/LoginPage";
import LandingPage from "@/components/LandingPage";

const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600" />
    </div>
  ),
});

// ---- helpers ----
function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
  return m ? decodeURIComponent(m[2]) : null;
}

function getInitialAuth() {
  // read from cookie first (works across tabs), then localStorage
  try {
    const cookieToken = readCookie("userToken");
    if (cookieToken) return true;
    if (typeof localStorage !== "undefined") {
      return !!localStorage.getItem("userToken");
    }
  } catch {}
  return false;
}

function getInitialForceLogin() {
  try {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("auth") === "login";
    }
  } catch {}
  return false;
}

export default function HomePage() {
  // Synchronous initial values -> no first-render spinner
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(getInitialAuth);
  const [forceLogin, setForceLogin] = useState<boolean>(getInitialForceLogin);
  const router = useRouter();

  // Keep auth in sync if another tab logs in/out
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "userToken") {
        setIsAuthenticated(!!e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!isAuthenticated) {
    if (forceLogin) {
      return (
        <LoginPage
          onLogin={() => {
            // Mark auth
            setIsAuthenticated(true);
            // Remove ?auth=login (and keep other params)
            const params = new URLSearchParams(window.location.search);
            params.delete("auth");
            const next = "/" + (params.toString() ? `?${params.toString()}` : "");
            setForceLogin(false);
            router.replace(next);
          }}
        />
      );
    }
    // Your LandingPage already uses SplashGate to block until assets are fully ready
    return <LandingPage />;
  }

  return (
    <Dashboard
      onDashboardLogout={() => {
        try {
          localStorage.removeItem("userToken");
          localStorage.removeItem("user");
          localStorage.removeItem("authMethod");
        } catch {}
        document.cookie = "userToken=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;";
        setIsAuthenticated(false);
        router.replace("/");
      }}
    />
  );
}
