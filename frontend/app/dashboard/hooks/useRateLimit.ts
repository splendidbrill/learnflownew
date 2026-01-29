"use client";

import { useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface RateLimitResult {
  canUse: boolean;
  currentUsage: number;
  limit: number;
  featureName: string;
  tier: string;
}

interface UseRateLimitReturn {
  checkLimit: (feature: string) => Promise<RateLimitResult | null>;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for checking rate limits against user's subscription tier.
 * 
 * Features: subjects, books_per_month, diagrams_per_hour, diagrams_per_month, lessons_per_day
 */
export function useRateLimit(userId: string): UseRateLimitReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkLimit = useCallback(async (feature: string): Promise<RateLimitResult | null> => {
    if (!userId) {
      setError("No user ID");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/rate-limit/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, feature }),
      });

      if (!res.ok) {
        throw new Error("Failed to check rate limit");
      }

      const data = await res.json();

      return {
        canUse: data.can_use,
        currentUsage: data.current_usage,
        limit: data.limit,
        featureName: data.feature_name,
        tier: data.tier,
      };
    } catch (err: any) {
      setError(err.message || "Rate limit check failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return { checkLimit, loading, error };
}

/**
 * Track diagram usage - call this when a user analyzes a diagram.
 */
export async function trackDiagramUsage(userId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/rate-limit/track-diagram/${userId}`, {
      method: "POST",
    });
    return res.ok;
  } catch {
    return false;
  }
}
