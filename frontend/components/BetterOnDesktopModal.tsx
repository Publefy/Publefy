"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Monitor } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const STORAGE_KEY = "betterOnDesktopDismissed";

export function BetterOnDesktopModal() {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    // Only show on mobile devices
    if (!isMobile) {
      return;
    }

    // Check if user has dismissed this modal
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed === "true") {
      return;
    }

    // Check if user is authenticated (has token)
    const token = localStorage.getItem("userToken");
    if (!token) {
      return;
    }

    // Show modal after a short delay to ensure smooth transition after login
    const timer = setTimeout(() => {
      setOpen(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [isMobile]);

  const handleGotIt = () => {
    setOpen(false);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
  };

  if (!isMobile) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md rounded-lg p-6">
        <DialogHeader className="text-left pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Monitor className="w-5 h-5 text-blue-600" />
            Better on Desktop
          </DialogTitle>
          <DialogDescription className="text-base text-gray-600 pt-2">
            For the best experience, open PubleFy on a desktop.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between pt-2">
          <Button
            onClick={handleGotIt}
            className="bg-gray-800 hover:bg-gray-900 text-white rounded-lg px-6 h-10 font-medium"
          >
            Got it
          </Button>
          <button
            onClick={handleDontShowAgain}
            className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2 cursor-pointer"
          >
            Don't show again
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

