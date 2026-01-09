"use client";
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtext?: string; // <--- NEW: For Rank/Level details
  showProgressBar?: boolean;
  progressValue?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  subtext,
  showProgressBar, 
  progressValue 
}) => {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:bg-white/10 transition-colors group">
      {/* Header */}
      <div className="flex justify-between items-start">
        <span className="text-gray-300 font-medium text-sm">{title}</span>
        <div className="p-2 rounded-lg bg-white/5 group-hover:bg-purple-500/20 transition-colors">
          <Icon className="w-5 h-5 text-purple-400 group-hover:text-purple-200" />
        </div>
      </div>
      
      {/* Value Area */}
      <div className="mt-4">
        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
        
        {/* Subtext (e.g. Rank) */}
        {subtext && (
          <p className="text-xs text-gray-400 mt-1 font-medium flex items-center gap-1">
            {subtext}
          </p>
        )}
        
        {/* Progress Bar (for Subjects/Completion) */}
        {showProgressBar && (
          <div className="mt-3 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all duration-1000" 
              style={{ width: `${progressValue}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};