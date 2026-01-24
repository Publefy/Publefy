// Initial deployment for Publefy
import type { Metadata } from "next";
import "./globals.css"; 
import { ToastProvider } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";
import { StructuredData } from "./structured-data";
export const metadata: Metadata = {
  title: {
    default: "Publefy – AI Meme Generator for Instagram",
    template: "%s | Publefy",
  },
  description:
    "Publefy is an AI-powered software that removes text from reels, analyzes video context, generates viral memes, and schedules Instagram posts automatically. Create engaging content for Instagram, Facebook, TikTok, and more with one-click automation.",
  keywords: [
    "AI Meme Generator",
    "Instagram Reels Automation",
    "Video Text Removal",
    "GPT Meme Software",
    "Publefy",
    "OpenAI Meme Creator",
    "Instagram Scheduler",
    "viral memes",
    "meme generator",
    "social media automation",
  ],
  authors: [{ name: "Publefy Team", url: "https://publefy.com" }],
  creator: "Publefy",
  publisher: "Publefy",
  metadataBase: new URL("https://publefy.com"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/publefy-logo.png",
    shortcut: "/publefy-logo.png",
    apple: "/publefy-logo.png",
  },
  openGraph: {
    type: "website",
    url: "https://publefy.com",
    title: "Publefy – AI-Powered Meme Generator for Instagram",
    description:
      "Generate viral memes with AI, schedule and post them directly to Instagram, Facebook, TikTok, and more. One-click automation for creators and brands.",
    siteName: "Publefy",
    locale: "en_US",
    images: [
      {
        url: "/publefy-logo.png",
        width: 1200,
        height: 630,
        alt: "Publefy - AI Meme Generator for Instagram",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Publefy – AI-Powered Meme Generator for Instagram",
    description:
      "Generate viral memes with AI, schedule and post them directly to Instagram, Facebook, TikTok, and more. One-click automation for creators and brands.",
    images: ["/publefy-logo.png"],
    creator: "@publefy",
    site: "@publefy",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
  verification: {
    // Add your verification codes here when available
    // google: "your-google-verification-code",
    // yandex: "your-yandex-verification-code",
    // bing: "your-bing-verification-code",
  },
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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, user-scalable=yes" />
        <meta name="theme-color" content="#301B69" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="apple-mobile-web-app-title" content="Publefy" />
        <link rel="apple-touch-icon" href="/publefy-logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      </head>
      <body>
        <StructuredData />
        <ToastProvider>
          {children}<Toaster />
        </ToastProvider>
      </body>
    </html>
  );
}
