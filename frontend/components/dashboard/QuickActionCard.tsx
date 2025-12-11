import React from 'react';
import { LucideIcon } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export const QuickActionCard: React.FC<QuickActionCardProps> = ({ title, description, icon: Icon }) => {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center hover:bg-white/10 hover:scale-[1.02] transition-all cursor-pointer group">
      <div className="mb-6 p-4 rounded-full bg-white/5 group-hover:bg-purple-600/20 transition-colors">
        <Icon className="w-8 h-8 text-purple-300 group-hover:text-purple-200" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
};
