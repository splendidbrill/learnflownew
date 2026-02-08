"use client";

import { useEffect, useState } from "react";
import { Trophy, Medal, Award, TrendingUp } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface LeaderboardEntry {
  id: string;
  email: string;
  level: number;
  xp: number;
  badge_count: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${API_URL}/api/gamification/leaderboard?limit=20`);
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      
      const data = await response.json();
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-8 h-8 text-yellow-500" />;
    if (index === 1) return <Medal className="w-7 h-7 text-gray-400" />;
    if (index === 2) return <Award className="w-6 h-6 text-orange-600" />;
    return null;
  };

  const getRankColor = (index: number) => {
    if (index === 0) return "from-yellow-600 to-yellow-500";
    if (index === 1) return "from-gray-600 to-gray-500";
    if (index === 2) return "from-orange-600 to-orange-500";
    return "from-gray-700 to-gray-800";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
        <div className="max-w-4xl mx-auto text-center text-white">
          Loading leaderboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Trophy className="w-12 h-12 text-yellow-500" />
            <h1 className="text-4xl font-bold text-white">Leaderboard</h1>
          </div>
          <p className="text-gray-400">
            Top {leaderboard.length} learners by XP and level
          </p>
        </div>

        {/* Leaderboard List */}
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.id}
              className={`bg-gradient-to-r ${getRankColor(index)} rounded-xl p-4 border ${
                index < 3 ? "border-yellow-500/30" : "border-gray-700"
              } hover:scale-[1.02] transition-transform`}
            >
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className="w-16 text-center">
                  {getRankIcon(index) || (
                    <div className="text-2xl font-bold text-gray-400">
                      #{index + 1}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <div className="font-bold text-white text-lg">
                    {entry.email.split("@")[0]}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-300 mt-1">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Level {entry.level}
                    </span>
                    <span>•</span>
                    <span>{entry.xp.toLocaleString()} XP</span>
                    {entry.badge_count > 0 && (
                      <>
                        <span>•</span>
                        <span>{entry.badge_count} badges</span>
                      </>
                    )}
                  </div>
                </div>

                {/* XP Display */}
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {entry.xp.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">XP</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center text-gray-400 mt-12">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p>No leaderboard data yet. Start learning to appear here!</p>
          </div>
        )}
      </div>
    </div>
  );
}
