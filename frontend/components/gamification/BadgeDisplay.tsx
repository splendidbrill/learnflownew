/**
 * Badge Display Component - Shows user achievements
 */

import { Trophy, Award, Flame, Star, Zap, BookOpen, Target, Crown } from "lucide-react";

interface Badge {
  badge_type: string;
  badge_name: string;
  badge_description: string;
  earned_at: string;
}

interface BadgeDisplayProps {
  badges: Badge[];
}

const BADGE_ICONS: Record<string, any> = {
  first_steps: BookOpen,
  biology_master: Trophy,
  "10_day_streak": Flame,
  night_owl: Star,
  early_bird: Zap,
  concept_crusher: Target,
  test_ace: Award,
  chapter_champion: Crown,
};

const BADGE_COLORS: Record<string, string> = {
  first_steps: "bg-blue-500",
  biology_master: "bg-purple-500",
  "10_day_streak": "bg-orange-500",
  night_owl: "bg-indigo-500",
  early_bird: "bg-yellow-500",
  concept_crusher: "bg-red-500",
  test_ace: "bg-green-500",
  chapter_champion: "bg-pink-500",
};

export default function BadgeDisplay({ badges }: BadgeDisplayProps) {
  if (!badges || badges.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 text-center">
        <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400">No badges earned yet</p>
        <p className="text-sm text-gray-500 mt-1">Keep learning to unlock achievements!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {badges.map((badge) => {
        const Icon = BADGE_ICONS[badge.badge_type] || Award;
        const colorClass = BADGE_COLORS[badge.badge_type] || "bg-gray-500";

        return (
          <div
            key={badge.badge_type}
            className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-4 border border-gray-700 hover:border-purple-500 transition-all group"
          >
            <div className={`${colorClass} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
              <Icon className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-white text-center text-sm">
              {badge.badge_name}
            </h3>
            <p className="text-xs text-gray-400 text-center mt-1">
              {badge.badge_description}
            </p>
            <p className="text-xs text-gray-500 text-center mt-2">
              {new Date(badge.earned_at).toLocaleDateString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
