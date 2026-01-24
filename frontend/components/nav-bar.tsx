"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ChevronDown } from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// 🔡 Characters for effect
const allowedCharacters = ["ア","イ","ウ","エ","オ","カ","キ","ク","ケ","コ","サ","シ","ス","セ","ソ"];
const getRandomCharacter = () => allowedCharacters[Math.floor(Math.random() * allowedCharacters.length)];

// Hover scramble utilities
const hoverTimeouts = new WeakMap<HTMLElement, number[]>();
function createEventHandler() {
  return function handleHoverEvent(e: React.MouseEvent<HTMLElement>) {
    if (typeof window === "undefined") return;
    const target = e.currentTarget as HTMLElement;
    if (target.getAttribute("data-scrambling") === "1") return;
    const originalText = target.textContent || "";
    const randomizedText = originalText.split("").map(() => getRandomCharacter()).join("");
    target.setAttribute("data-original-text", originalText);
    target.setAttribute("data-scrambling", "1");
    target.textContent = randomizedText;
    const ids: number[] = [];
    for (let i = 0; i < originalText.length; i++) {
      const id = window.setTimeout(() => {
        const nextIndex = i + 1;
        target.textContent = `${originalText.substring(0, nextIndex)}${randomizedText.substring(nextIndex)}`;
        if (nextIndex === originalText.length) target.removeAttribute("data-scrambling");
      }, i * 80);
      ids.push(id);
    }
    hoverTimeouts.set(target, ids);
  };
}
function resetHoverText(e: React.MouseEvent<HTMLElement>) {
  const target = e.currentTarget as HTMLElement;
  const ids = hoverTimeouts.get(target);
  if (ids && ids.length) ids.forEach((id) => clearTimeout(id));
  hoverTimeouts.delete(target);
  const originalText = target.getAttribute("data-original-text");
  if (originalText != null) target.textContent = originalText;
  target.removeAttribute("data-scrambling");
  target.removeAttribute("data-original-text");
}

// Scroll helper
const scrollToId = (id: string) => {
  if (typeof window !== "undefined") {
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) {
        const header = document.querySelector("header");
        const pillH = (header as HTMLElement | null)?.offsetHeight ?? 80;
        const topGap = 20;
        const offset = pillH + topGap;
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    });
  }
};

export const navLinks = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it Works" },
  { id: "pricing", label: "Pricing" },
  { id: "testimonials", label: "Testimonials" },
  { id: "faq", label: "FAQ" },
];

// Split nav links for tablet/small desktop variant
const visibleNavLinks = navLinks.slice(0, 3); // Features, How it Works, Pricing
const dropdownNavLinks = navLinks.slice(3); // Testimonials, FAQ

export function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">("dark");

  const handleGetStarted = () => router.push("/?auth=login");

  // Click handler for all nav items (keeps URL clean)
  const handleAnchor = (id: string) => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isMobile = window.innerWidth < 768;
    setIsMobileMenuOpen(false);

    if (pathname !== "/") {
      // handoff to landing page without adding hash/params to URL
      sessionStorage.setItem("scrollTarget", id);
      router.push("/", { scroll: false }); // prevent default top jump
      return;
    }
    
    // On mobile, wait for menu to close before scrolling
    if (isMobile) {
      setTimeout(() => {
        requestAnimationFrame(() => {
          scrollToId(id);
        });
      }, 300); // Wait for menu close animation
    } else {
      scrollToId(id);
    }
  };

  const prefersReducedMotion = useReducedMotion();

  // Detect scroll and check if past hero section (for landing page)
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const handleScroll = () => {
        // Use 12px threshold for smoother transition
        const scrolled = window.scrollY > 12;
        setIsScrolled(scrolled);
        // Add class to body for CSS targeting
        document.body.classList.toggle('header-scrolled', scrolled);

        // If on landing page, check if we've scrolled past hero section
        const main = document.querySelector('main') || document.body;
        const firstSection = main.querySelector('section:first-of-type') || main.querySelector('div[class*="hero"]');
        if (firstSection) {
          const heroRect = firstSection.getBoundingClientRect();
          const heroBottom = heroRect.bottom;
          // Switch to light theme when hero section is mostly out of view (when bottom is above 20% of viewport)
          if (heroBottom < window.innerHeight * 0.2) {
            setEffectiveTheme("light");
          } else {
            setEffectiveTheme("dark");
          }
        } else {
          setEffectiveTheme("dark");
        }
      };
      window.addEventListener("scroll", handleScroll);
      handleScroll(); // Check initial state
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleResize = () => {
        if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  // 🧱 Prevent background scroll when mobile menu open
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (isMobileMenuOpen) {
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.width = "100%";
        document.body.style.top = `-${window.scrollY}px`;
      } else {
        const scrollY = document.body.style.top;
        document.body.style.overflow = "auto";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.top = "";
        if (scrollY) {
          window.scrollTo(0, parseInt(scrollY || '0') * -1);
        }
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "auto";
        document.body.style.position = "";
        document.body.style.width = "";
        document.body.style.top = "";
      }
    };
  }, [isMobileMenuOpen]);

  // Handle escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsMobileMenuOpen(false);
    }
    if (isMobileMenuOpen) {
      window.addEventListener("keydown", onKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <header
      className={cn(
        "fixed left-0 right-0 z-50",
        prefersReducedMotion ? "" : "transition-all duration-300",
        isScrolled ? "top-4" : "top-0 md:top-10"
      )}
    >
      {/* 🌀 Curved / Liquid Animation Behind */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            key="liquid-bg"
            initial={prefersReducedMotion ? false : { clipPath: "circle(0% at 50% 0%)" }}
            animate={
              prefersReducedMotion
                ? {}
                : {
              clipPath: "circle(180% at 50% 50%)",
              transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] },
                  }
            }
            exit={
              prefersReducedMotion
                ? {}
                : {
              clipPath: "circle(0% at 50% 0%)",
              transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
                  }
            }
            className="absolute top-0 left-0 w-full h-screen bg-slate-100 dark:bg-slate-900 z-0"
            style={{ transformOrigin: "top center" }}
          />
        )}
      </AnimatePresence>

      {/* Header Content - Consistent container */}
      <div
        className={cn(
          "relative z-50 flex items-center justify-between",
          "max-w-xs sm:max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto",
          "px-4 sm:px-6 md:px-6 lg:px-8",
          "py-1.5 md:py-2",
          "rounded-full",
          prefersReducedMotion ? "" : "transition-all duration-300 ease-in-out",
          !isScrolled && "md:mt-2"
        )}
        style={
          prefersReducedMotion
            ? {}
            : {
                transform: isScrolled ? "translateY(0)" : "translateY(0)",
              }
        }
      >
        {/* Glass wrapper - always present, subtle on top, stronger on scroll */}
        {isMounted && (
          <div
            className={cn(
              "absolute inset-0 -z-10 rounded-full",
              prefersReducedMotion ? "" : "transition-all duration-300 ease-in-out",
              // Base glass (always visible, subtle)
              "bg-white/30 backdrop-blur-sm",
              // Scrolled state: stronger glass
              isScrolled
                ? "bg-white/70 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-white/40"
                : "bg-white/20 backdrop-blur-sm shadow-none border border-white/20"
            )}
          />
        )}

        {/* Logo */}
        <Link href="/" className="flex items-center space-x-2 shrink-0">
          <Image
            src="/logo-marker.png"
            alt="Publefy"
            width={121}
            height={50}
            priority
            className={cn(
              "w-[121px] h-[50px]",
              prefersReducedMotion ? "" : "transition-transform duration-200 hover:scale-105"
            )}
          />
        </Link>

        {/* Tablet/Small Desktop Navigation (768-1279px) */}
        <nav className="hidden md:flex xl:hidden items-center space-x-2 flex-1 justify-center px-2 font-inter min-w-0">
          {visibleNavLinks.map((link) => {
            const eventHandler = createEventHandler();
            return (
              <a
                key={link.id}
                href="#"
                onClick={handleAnchor(link.id)}
                onMouseOver={eventHandler}
                onMouseLeave={resetHoverText}
                className={cn(
                  "group px-2 text-xs font-medium cursor-pointer whitespace-nowrap inline-block relative",
                  "text-[#301B69]/80 hover:text-[#301B69]",
                  prefersReducedMotion ? "" : "transition-colors duration-200"
                )}
                style={{
                  width: `${(link.label.length + 3) * 8}px`,
                  textAlign: "center",
                  minWidth: `${(link.label.length + 3) * 8}px`,
                  maxWidth: `${(link.label.length + 3) * 8}px`,
                  overflow: "visible",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {link.label}
                {/* Hover underline */}
                <span
                  className={cn(
                    "absolute bottom-[-2px] left-0 right-0 h-[1.5px] bg-[#301B69]",
                    prefersReducedMotion ? "" : "transition-transform duration-200 ease-out",
                    "scale-x-0 group-hover:scale-x-100"
                  )}
                  style={{
                    transformOrigin: "center",
                  }}
                />
              </a>
            );
          })}
          {/* More dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "group px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap inline-flex items-center gap-1",
                  "text-[#301B69]/80 hover:text-[#301B69]",
                  "rounded-full border border-[#301B69]/20 hover:border-[#301B69]/40",
                  "bg-white/30 backdrop-blur-sm",
                  prefersReducedMotion ? "" : "transition-all duration-200"
                )}
                style={{
                  fontFamily: "Inter, sans-serif",
                  height: "36px",
                }}
              >
                More
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-[140px] bg-white/95 backdrop-blur-md border border-white/40 shadow-lg"
            >
              {dropdownNavLinks.map((link) => {
                const eventHandler = createEventHandler();
                return (
                  <DropdownMenuItem
                    key={link.id}
                    onClick={handleAnchor(link.id)}
                    onMouseOver={eventHandler}
                    onMouseLeave={resetHoverText}
                    className="cursor-pointer text-[#301B69] font-inter text-sm px-3 py-2"
                  >
                    {link.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Full Desktop Navigation (>=1280px) */}
        <nav className="hidden xl:flex items-center space-x-2 lg:space-x-3 flex-1 justify-center px-2 font-inter min-w-0">
          {navLinks.map((link) => {
            const eventHandler = createEventHandler();
            return (
              <a
                key={link.id}
                href="#"
                onClick={handleAnchor(link.id)}
                onMouseOver={eventHandler}
                onMouseLeave={resetHoverText}
                className={cn(
                  "group px-2 text-xs font-medium cursor-pointer whitespace-nowrap inline-block relative",
                  "text-[#301B69]/80 hover:text-[#301B69]",
                  prefersReducedMotion ? "" : "transition-colors duration-200"
                )}
                style={{
                  width: `${(link.label.length + 3) * 8}px`,
                  textAlign: "center",
                  minWidth: `${(link.label.length + 3) * 8}px`,
                  maxWidth: `${(link.label.length + 3) * 8}px`,
                  overflow: "visible",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {link.label}
                {/* Hover underline */}
                <span
                  className={cn(
                    "absolute bottom-[-2px] left-0 right-0 h-[1.5px] bg-[#301B69]",
                    prefersReducedMotion ? "" : "transition-transform duration-200 ease-out",
                    "scale-x-0 group-hover:scale-x-100"
                  )}
                  style={{
                    transformOrigin: "center",
                  }}
                />
              </a>
            );
          })}
        </nav>

        {/* Right actions - Tablet/Small Desktop (768-1279px) */}
        <div className="hidden md:flex xl:hidden items-center space-x-2 shrink-0 min-w-0">
          <button
            onClick={handleGetStarted}
            className={cn(
              "shimmer1 relative inline-flex items-center justify-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white whitespace-nowrap shadow-lg",
              prefersReducedMotion ? "" : "transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            )}
            style={{
              background: "linear-gradient(182.28deg, #271850 36.46%, #301B69 97.83%)",
              fontFamily: "Inter, sans-serif",
              height: "36px",
            }}
          >
            <span className="relative z-10">Get Started</span>
            <ArrowRight className="h-4 w-4 relative z-10" />
          </button>
        </div>

        {/* Right actions - Full Desktop (>=1280px) */}
        <div className="hidden xl:flex items-center space-x-3 lg:space-x-4 shrink-0 min-w-0">
          <button
            onClick={handleGetStarted}
            className={cn(
              "shimmer1 relative inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white whitespace-nowrap shadow-lg",
              prefersReducedMotion ? "" : "transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            )}
            style={{
              background: "linear-gradient(182.28deg, #271850 36.46%, #301B69 97.83%)",
              fontFamily: "Inter, sans-serif",
              height: "36px", // Tighter capsule height
            }}
          >
            <span className="relative z-10">Get Started</span>
            <ArrowRight className="h-4 w-4 relative z-10" />
          </button>
        </div>

        {/* Mobile Menu Toggle - Always visible chip */}
        <div className="md:hidden ml-auto z-50">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              "relative inline-flex items-center justify-center w-10 h-10 rounded-full",
              "bg-white/20 backdrop-blur-sm border border-white/30",
              "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
              prefersReducedMotion ? "" : "transition-all duration-200 active:scale-[0.98]",
              "hover:bg-white/30"
            )}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu-animated-smooth"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <svg
                className="w-5 h-5 text-[#301B69]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-[#301B69]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
      {isMobileMenuOpen && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: prefersReducedMotion ? 0.1 : 0.2 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-[#301B69]/20 backdrop-blur-sm z-[60]"
              aria-hidden="true"
            />

            {/* Drawer Panel */}
            <motion.div
          id="mobile-menu-animated-smooth"
              role="dialog"
              aria-modal="true"
              aria-label="Mobile navigation"
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: 16, translateX: "16px" }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, x: 0, translateX: "0px" }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: 16, translateX: "16px" }
              }
              transition={{
                duration: prefersReducedMotion ? 0.15 : 0.24,
                ease: "easeOut",
              }}
              className="md:hidden fixed right-0 top-0 bottom-0 z-[70] w-[88vw] max-w-[360px] h-screen flex flex-col"
            >
              {/* Glass Panel Background */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-white/95 via-white/90 to-[#F5F0FF]/95 backdrop-blur-md border-l border-white/40 shadow-[0_0_40px_rgba(48,27,105,0.15)] rounded-l-[24px]"
                style={{ WebkitBackdropFilter: "blur(12px)" }}
              />

              {/* Content Container */}
              <div className="relative z-10 flex flex-col h-full">
          {/* Header Section */}
                <div className="flex items-center justify-between p-6 border-b border-[#301B69]/10">
            {/* Logo */}
                  <Link
                    href="/"
                    className="flex items-center space-x-2 shrink-0"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
              <Image
                src="/logo-marker.png"
                alt="Publefy"
                width={121}
                height={50}
                className="w-[121px] h-[50px]"
              />
            </Link>
            
                  {/* Close Button - Glass Chip Style */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "relative inline-flex items-center justify-center w-10 h-10 rounded-full",
                      "bg-white/30 backdrop-blur-sm border border-white/40",
                      "shadow-[0_2px_8px_rgba(0,0,0,0.08)]",
                      prefersReducedMotion ? "" : "transition-all duration-200 active:scale-[0.98]",
                      "hover:bg-white/40 focus:outline-none focus:ring-2 focus:ring-[#301B69]/20 focus:ring-offset-2"
                    )}
              aria-label="Close menu"
            >
              <svg
                      className="w-5 h-5 text-[#301B69]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

                {/* Menu Links - Pill Buttons */}
                <nav className="flex flex-col px-4 py-6 flex-1 overflow-y-auto font-inter gap-2">
                  <AnimatePresence>
                    {navLinks.map((link, index) => {
              const eventHandler = createEventHandler();
              return (
                        <motion.button
                  key={link.id}
                  type="button"
                  onClick={handleAnchor(link.id)}
                  onMouseOver={eventHandler}
                  onMouseLeave={resetHoverText}
                          initial={
                            prefersReducedMotion
                              ? { opacity: 0 }
                              : { opacity: 0, x: 8 }
                          }
                          animate={
                            prefersReducedMotion
                              ? { opacity: 1 }
                              : { opacity: 1, x: 0 }
                          }
                          transition={{
                            duration: prefersReducedMotion ? 0.1 : 0.2,
                            delay: prefersReducedMotion ? 0 : index * 0.04,
                            ease: "easeOut",
                          }}
                          className={cn(
                            "group relative flex items-center justify-between",
                            "h-[52px] px-4 rounded-full",
                            "bg-white/40 backdrop-blur-sm border border-white/30",
                            "text-[#301B69] font-medium text-base",
                            "cursor-pointer",
                            prefersReducedMotion
                              ? ""
                              : "transition-all duration-200 hover:bg-white/60 hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.99] active:bg-white/50",
                            "focus:outline-none focus:ring-2 focus:ring-[#301B69]/20 focus:ring-offset-2"
                          )}
                        >
                          <span className="flex items-center gap-3">
                            <span className="font-inter">{link.label}</span>
                          </span>
                          <svg
                            className="w-4 h-4 text-[#301B69]/40 group-hover:text-[#301B69]/60 transition-colors"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </motion.button>
              );
            })}
                  </AnimatePresence>
          </nav>

                {/* Sticky CTA Footer */}
                <div className="sticky bottom-0 p-6 pt-4 border-t border-[#301B69]/10 bg-gradient-to-b from-transparent to-white/30 backdrop-blur-sm">
                  <p className="text-sm text-[#301B69]/60 mb-3 text-center font-inter">
                    Ready to start?
                  </p>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleGetStarted();
              }}
                    className={cn(
                      "shimmer1 w-full inline-flex items-center justify-center gap-2 rounded-full py-3.5 px-6",
                      "text-base font-inter font-semibold text-white shadow-lg",
                      prefersReducedMotion
                        ? ""
                        : "transition-all duration-200 hover:opacity-90 active:scale-[0.98]",
                      "focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2"
                    )}
              style={{
                      background:
                        "linear-gradient(182.28deg, #271850 36.46%, #301B69 97.83%)",
              }}
            >
              <span className="relative z-10">Get Started</span>
              <ArrowRight className="h-4 w-4 relative z-10" />
            </button>
          </div>
        </div>
            </motion.div>
          </>
      )}
      </AnimatePresence>
    </header>
  );
}
