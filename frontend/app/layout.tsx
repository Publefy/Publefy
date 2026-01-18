// Initial deployment for Publefy
import type { Metadata } from "next";
import "./globals.css"; 
import { ToastProvider } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";
export const metadata: Metadata = {
  title: "Publefy – AI Meme Generator for Instagram",
  description:
    "Publefy is an AI-powered software that removes text from reels, analyzes video context, generates viral memes, and schedules Instagram posts automatically.",
  keywords: [
    "AI Meme Generator",
    "Instagram Reels Automation",
    "Video Text Removal",
    "GPT Meme Software",
    "Publefy",
    "OpenAI Meme Creator",
    "Instagram Scheduler",
  ],
  authors: [{ name: "Publefy Team", url: "https://publefy.vercel.app" }],
  icons: {
    icon: "/publefy-logo.png",
    shortcut: "/publefy-logo.png",
    apple: "/publefy-logo.png",
  },
  openGraph: {
    type: "website",
    url: "https://publefy.vercel.app",
    title: "Publefy – AI-Powered Meme Generator",
    description:
      "Generate memes with AI, schedule and post them directly to Instagram with style-matched overlays and automation.",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/publefy-logo.png" />
      </head>
      <body> <ToastProvider>
          {children}<Toaster />
        </ToastProvider></body>
    </html>
  );
}
