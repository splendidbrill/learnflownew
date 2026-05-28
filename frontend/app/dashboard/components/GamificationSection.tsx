"use client";

import { useEffect, useState } from "react";
import BadgeDisplay from "@/components/gamification/BadgeDisplay";
import LevelProgress from "@/components/gamification/LevelProgress";
import { Trophy } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface GamificationSectionProps {
  userId: string;
}

export function GamificationSection({ userId }: GamificationSectionProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGamificationData();
  }, [userId]);

  const fetchGamificationData = async () => {
    try {
      const response = await fetch(`${API_URL}/gamification/user-stats/${userId}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch gamification data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 animate-pulse">
        <div className="h-24 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Level Progress */}
      <LevelProgress levelData={data.level} />

      {/* Badges */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Your Achievements</h2>
          <Link
            href="/dashboard/leaderboard"
            className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
          >
            <Trophy className="w-4 h-4" />
            View Leaderboard
          </Link>
        </div>
        <BadgeDisplay badges={data.badges} />
      </div>
    </div>
  );
}
