"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, User, ExternalLink, LogOut } from "lucide-react";

interface AdminHeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export function AdminHeader({ isDarkMode, onToggleDarkMode }: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("user");
    localStorage.removeItem("authMethod");
    document.cookie = "userToken=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/;";
    router.replace("/?auth=login");
  };
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setShowDropdown(true);
  };

  const handleMouseLeave = () => {
    const id = setTimeout(() => {
      setShowDropdown(false);
    }, 150); // Small delay to prevent flickering
    setTimeoutId(id);
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-end">
     

      {/* Right side - Dark mode toggle, email, avatar */}
      <div className="flex items-center space-x-4">

        {/* User email */}
        <span className="text-sm text-gray-600">example@example.co</span>

        {/* User avatar with dropdown */}
        <div 
          className="relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            <span className="text-white font-bold text-sm">P</span>
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <>
              {/* Invisible bridge to prevent gap */}
              <div className="absolute right-0 top-full w-48 h-1 bg-transparent" style={{ marginTop: '-1px' }}></div>
              <div 
                className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                style={{ marginTop: '-4px' }}
              >
              <a 
                href="#" 
                className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-gray-500" />
                <span>Profile</span>
              </a>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="w-4 h-4 text-gray-500" />
                <span>Log out</span>
              </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
} 