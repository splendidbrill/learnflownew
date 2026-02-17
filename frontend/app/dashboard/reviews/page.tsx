"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Clock, BookOpen, QrCode, X, Volume2 } from "lucide-react";
import Image from "next/image";

const supabase = createClient();
const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface Review {
  id: string;
  concept: string;
  paragraph_id: string;
  book_id: string;
  failed_explanation: string;
  next_review_date: string;
  interval_days: number;
  review_count: number;
}

export default function ReviewQueue() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQRCodeUrl] = useState<string>("");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadReviews();
    checkTelegramConnection();
  }, []);

  const loadReviews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(`${API_URL}/api/reviews/queue/${user.id}`);
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error("Failed to load reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkTelegramConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", user.id)
        .single();

      setTelegramConnected(!!data?.telegram_chat_id);
    } catch (error) {
      console.error("Failed to check Telegram connection:", error);
    }
  };

  const playAudio = async (text: string, reviewId: string) => {
    try {
      // Stop current audio if playing
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
        setPlayingAudio(null);
      }

      setPlayingAudio(reviewId);

      const response = await fetch(`${API_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error("TTS failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        setPlayingAudio(null);
        setCurrentAudio(null);
      };

      setCurrentAudio(audio);
      await audio.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setPlayingAudio(null);
    }
  };

  const handleCompleteReview = async (reviewId: string, success: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await fetch(`${API_URL}/api/reviews/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_id: reviewId,
          user_id: user.id,
          success
        })
      });

      // Reload reviews
      loadReviews();
    } catch (error) {
      console.error("Failed to complete review:", error);
    }
  };

  const handleConnectTelegram = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Use the new endpoint that returns a PNG image directly
      const qrUrl = `${API_URL}/api/user/telegram-qr/${user.id}`;
      setQRCodeUrl(qrUrl);
      setShowQRModal(true);
    } catch (error) {
      console.error("Failed to generate QR code:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white">Loading reviews...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Review Queue</h1>
            <p className="text-gray-400">Concepts you need to review</p>
          </div>

          {/* Telegram Connection */}
          {!telegramConnected && (
            <button
              onClick={handleConnectTelegram}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <QrCode className="w-5 h-5" />
              Connect Telegram
            </button>
          )}
        </div>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 text-center">
            <BookOpen className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-white mb-2">No reviews due!</h2>
            <p className="text-gray-400">You're all caught up. Keep learning!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-1">{review.concept}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Clock className="w-4 h-4" />
                      <span>Review #{review.review_count + 1}</span>
                      <span>•</span>
                      <span>Next interval: {review.interval_days} days</span>
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-300 mb-2 font-semibold">Previous explanation:</p>
                  <p className="text-gray-400 text-sm">{review.failed_explanation}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleCompleteReview(review.id, true)}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                  >
                    ✓ Got it!
                  </button>
                  <button
                    onClick={() => handleCompleteReview(review.id, false)}
                    className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
                  >
                    🤔 Still confused
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {showQRModal && qrCodeUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>

            <h2 className="text-2xl font-bold text-white mb-2">Connect Telegram</h2>
            <p className="text-gray-400 mb-6">Scan this QR code with your phone camera or Google Lens</p>

            <div className="bg-white p-4 rounded-xl mb-6 flex items-center justify-center">
              <img
                src={qrCodeUrl}
                alt="Telegram QR Code"
                className="w-64 h-64"
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-300 font-medium mb-2">📱 How to scan:</p>
              <ul className="text-xs text-blue-200 space-y-1">
                <li>• Open your phone camera app</li>
                <li>• Point it at the QR code</li>
                <li>• Tap the notification to open Telegram</li>
                <li>• Or use Google Lens to scan</li>
              </ul>
            </div>

            <button
              onClick={() => setShowQRModal(false)}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
