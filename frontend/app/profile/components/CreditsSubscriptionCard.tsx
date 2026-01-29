"use client";
import React, { useState, useEffect } from "react";
import { Coins, Crown, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";

interface CreditsSubscriptionCardProps {
  userId: string;
}

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  explorer: { label: "Explorer", color: "text-gray-400" },
  scholar: { label: "Scholar", color: "text-blue-400" },
  master: { label: "Master", color: "text-purple-400" },
  elite: { label: "Elite", color: "text-amber-400" },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function CreditsSubscriptionCard({ userId }: CreditsSubscriptionCardProps) {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(0);
  const [tier, setTier] = useState("explorer");

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user/balance/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setCredits(data.credits || 0);
          setTier(data.subscription_tier || "explorer");
        }
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchBalance();
    }
  }, [userId]);

  const tierInfo = TIER_LABELS[tier] || TIER_LABELS.explorer;

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl shadow-purple-900/20">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <Coins className="w-5 h-5 text-amber-400" />
        Credits & Subscription
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Credits Display */}
        <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-2xl p-6 border border-amber-500/20">
          <p className="text-sm text-amber-300/80 mb-1">Your Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-amber-400">{credits}</span>
            <span className="text-amber-300/60">credits</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Use credits to upgrade your subscription
          </p>
        </div>

        {/* Subscription Tier Display */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <p className="text-sm text-gray-400 mb-1">Current Plan</p>
          <div className="flex items-center gap-3">
            <Crown className={`w-8 h-8 ${tierInfo.color}`} />
            <span className={`text-3xl font-bold ${tierInfo.color}`}>
              {tierInfo.label}
            </span>
          </div>
          {tier === "explorer" && (
            <p className="text-xs text-gray-500 mt-2">
              Free tier with limited features
            </p>
          )}
        </div>
      </div>

      {/* Upgrade CTA */}
      <Link
        href="/pricing"
        className="mt-6 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-4 rounded-xl font-bold transition-all hover:scale-[1.02] shadow-lg shadow-purple-900/30"
      >
        {tier === "explorer" ? "Upgrade with Credits" : "View Plans"}
        <ArrowRight className="w-5 h-5" />
      </Link>
    </div>
  );
}
