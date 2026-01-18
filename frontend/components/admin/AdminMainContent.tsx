"use client";

import { ChevronDown, TrendingDown, Sparkles } from "lucide-react";
import { AdminSalesOverview } from "./AdminSalesOverview";

interface AdminMainContentProps {
  activePage: string;
}

export function AdminMainContent({ activePage }: AdminMainContentProps) {
  const renderContent = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <AdminSalesOverview />
          </div>
        );
      case "administrators":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Administrators</h1>
            <p className="text-gray-600">Administrator management interface coming soon...</p>
          </div>
        );
      case "customers":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Customers</h1>
            <p className="text-gray-600">Customer management interface coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
      {renderContent()}
    </main>
  );
} 