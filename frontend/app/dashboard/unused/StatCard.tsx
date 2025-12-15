import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  showProgressBar?: boolean;
  progressValue?: number;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, showProgressBar, progressValue }) => {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 flex flex-col justify-between min-h-[140px] hover:bg-white/10 transition-colors">
      <div className="flex justify-between items-start">
        <span className="text-gray-300 font-medium text-sm">{title}</span>
        <Icon className="w-5 h-5 text-purple-400/70" />
      </div>
      
      <div className="mt-4">
        <h3 className="text-3xl font-bold text-white">{value}</h3>
        
        {showProgressBar && (
          <div className="mt-3 h-2 w-full bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-purple-500 rounded-full" 
              style={{ width: `${progressValue}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
