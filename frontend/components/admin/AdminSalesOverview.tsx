"use client";

import { ChevronDown, TrendingDown } from "lucide-react";

export function AdminSalesOverview() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  // Mock data for the chart
  const chartData2024 = [30, 45, 60, 75, 85, 90, 95, 88, 82, 78, 70, 65];
  const chartData2025 = [85, 70, 45, 20, 15, 10, 8, 12, 18, 25, 30, 35];

  const maxValue = Math.max(...chartData2024, ...chartData2025);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">Sales Overview</h3>
        
        {/* Year Dropdown */}
        <div className="relative">
          <button className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg transition-colors">
            <span className="text-sm font-medium text-gray-700">2024</span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Sales Figures */}
      <div className="flex items-center space-x-4 mb-6">
        <div className="text-3xl font-bold text-gray-900">$850,536</div>
        <div className="flex items-center space-x-1 text-red-500">
          <TrendingDown className="w-4 h-4" />
          <span className="text-sm font-medium">-81.5%</span>
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-4">
        <div className="h-48 flex items-end space-x-1 bg-gray-50 rounded-lg p-2">
          {months.map((month, index) => {
            const height2024 = (chartData2024[index] / maxValue) * 100;
            const height2025 = (chartData2025[index] / maxValue) * 100;
            
            return (
              <div key={month} className="flex-1 flex flex-col items-center space-y-1">
                {/* 2025 Line (Current Year) */}
                <div 
                  className="w-full bg-cyan-400 rounded-t min-h-[2px]"
                  style={{ height: `${Math.max(height2025, 2)}%` }}
                ></div>
                
                {/* 2024 Line with fill */}
                <div className="w-full relative">
                  <div 
                    className="w-full bg-blue-600 rounded-t min-h-[2px]"
                    style={{ height: `${Math.max(height2024, 2)}%` }}
                  ></div>
                  <div 
                    className="absolute inset-0 bg-blue-600/20 rounded-t"
                    style={{ height: `${Math.max(height2024, 2)}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* X-axis labels */}
        <div className="flex justify-between text-xs text-gray-500">
          {months.map((month) => (
            <span key={month} className="flex-1 text-center">
              {month}
            </span>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <span className="text-sm text-gray-600">2024</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
            <span className="text-sm text-gray-600">Current Year (2025)</span>
          </div>
        </div>
      </div>
    </div>
  );
} 