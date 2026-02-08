/**
 * Level Progress Component - XP bar and level display
 */

import { Star, TrendingUp } from "lucide-react";

interface LevelData {
  level: number;
  xp: number;
  next_level_xp: number;
}

interface LevelProgressProps {
  levelData: LevelData;
}

export default function LevelProgress({ levelData }: LevelProgressProps) {
  const { level, xp, next_level_xp } = levelData;
  const progress = (xp / next_level_xp) * 100;

  return (
    <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 rounded-xl p-6 border border-purple-500/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-full p-3">
            <Star className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Level {level}</h3>
            <p className="text-sm text-gray-300">
              {xp} / {next_level_xp} XP
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">{Math.round(progress)}%</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {next_level_xp - xp} XP to next level
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative h-4 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 rounded-full transition-all duration-500 animate-pulse"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      </div>

      <div className="mt-3 text-xs text-gray-400 text-center">
        Keep learning to level up!
      </div>
    </div>
  );
}
