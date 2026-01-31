"use client";
import React, { useState, useEffect } from "react";
import { X, Bell, Mail, Send, Clock, CheckCircle } from "lucide-react";

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Updated onSave signature to accept list of channels and timezone
  onSave: (time: string, channels: string[], timezone: string) => void;
  onSkip?: () => void;
  mode: "create" | "edit";
  userId: string;
  botName: string;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSkip,
  mode,
  userId,
  botName,
}) => {
  const [time, setTime] = useState("09:00");

  // Channels Selection
  const [channels, setChannels] = useState<{
    telegram: boolean;
    email: boolean;
  }>({
    telegram: true,
    email: false,
  });

  // Telegram Verification State
  const [isVerifying, setIsVerifying] = useState(false);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  // Email Verification State
  const [userEmail, setUserEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);

  // Auto-detect Timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Handle Telegram deep link with popup blocker detection
  const handleTelegramLink = () => {
    const deepLink = `https://t.me/${botName}?start=${userId}`;
    
    // Try to open in new window
    const newWindow = window.open(deepLink, "_blank");
    
    // Check if popup was blocked
    if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
      setPopupBlocked(true);
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(deepLink).then(() => {
        alert("🚫 Popup blocked!\n\n✅ Link copied to clipboard!\n\nPaste it in your browser or use the QR code below.");
      });
    }
  };

  // Fetch user email from Supabase when modal opens
  useEffect(() => {
    if (isOpen) {
      setPopupBlocked(false);
      fetchUserEmail();
    }
  }, [isOpen]);

  // Fetch user email from Supabase Auth
  const fetchUserEmail = async () => {
    setIsLoadingEmail(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user/email/${userId}`
      );
      const data = await res.json();
      if (data.email) {
        setUserEmail(data.email);
        setEmailVerified(true);
      }
    } catch (e) {
      console.error("Failed to fetch email:", e);
    } finally {
      setIsLoadingEmail(false);
    }
  };

  if (!isOpen) return null;

  // Call API to check if user has a chat_id linked
  const checkTelegramConnection = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/user/telegram-status/${userId}`
      );
      const data = await res.json();
      if (data.connected) {
        setTelegramConnected(true);
      } else {
        alert(
          "Not connected yet. Please click the link and press Start in Telegram."
        );
      }
    } catch (e) {
      console.error(e);
      alert("Connection check failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = () => {
    // 1. Convert object {telegram: true, email: false} -> ["telegram"]
    const selectedChannels = Object.keys(channels).filter(
      (k) => channels[k as keyof typeof channels]
    );

    // 2. Validation
    if (selectedChannels.length === 0) {
      alert("Please select at least one notification method.");
      return;
    }
    if (
      selectedChannels.includes("telegram") &&
      !telegramConnected &&
      mode === "create"
    ) {
      alert("Please verify your Telegram connection first.");
      return;
    }
    if (
      selectedChannels.includes("email") &&
      !emailVerified
    ) {
      alert("Please ensure your email is verified.");
      return;
    }

    // 3. Pass data back to BookClient
    onSave(time, selectedChannels, timezone);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e0a3c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-5 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-3">
          <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-2 text-purple-400 border border-purple-500/30">
            <Bell className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white">
            {mode === "create"
              ? "Build a Learning Habit"
              : "Edit Study Schedule"}
          </h2>
          <p className="text-xs text-gray-400 mt-1 italic px-4">
            "Consistency is key. Even 5 minutes a day makes you 44% better in a
            year."
          </p>
        </div>

        {/* 1. Time Picker */}
        <div className="space-y-1 mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
            <Clock className="w-3 h-3" /> Daily Time ({timezone})
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-xl font-bold focus:border-purple-500 focus:outline-none transition-all text-center"
          />
        </div>

        {/* 2. Channel Picker */}
        <div className="space-y-2 mb-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Notification Channels
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Telegram Button */}
            <button
              onClick={() =>
                setChannels({ telegram: true, email: false })
              }
              className={`relative p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                channels.telegram
                  ? "bg-blue-500/20 border-blue-500 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.2)]"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}
            >
              <Send className="w-4 h-4" />
              <span className="text-[10px] font-bold">Telegram</span>
              {channels.telegram && (
                <CheckCircle className="w-3 h-3 absolute top-1.5 right-1.5 text-blue-400" />
              )}
            </button>

            {/* Email Button */}
            <button
              onClick={() =>
                setChannels({ telegram: false, email: true })
              }
              className={`relative p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                channels.email
                  ? "bg-purple-500/20 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                  : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
              }`}
            >
              <Mail className="w-4 h-4" />
              <span className="text-[10px] font-bold">Email</span>
              {channels.email && (
                <CheckCircle className="w-3 h-3 absolute top-1.5 right-1.5 text-purple-400" />
              )}
            </button>
          </div>

          {/* Email Verification (Visible only if Email selected) */}
          {channels.email && (
            <div className="mt-2 bg-purple-900/10 border border-purple-500/20 rounded-lg p-3 text-[10px] text-purple-200 animate-in fade-in slide-in-from-top-2">
              {isLoadingEmail ? (
                <div className="text-center py-1 text-purple-300">Loading email...</div>
              ) : emailVerified && userEmail ? (
                <div className="flex items-center gap-2 text-green-400 font-bold justify-center py-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Email: {userEmail}</span>
                </div>
              ) : (
                <div className="text-center text-purple-300 py-1">
                  <p>⚠️ No email found in your account.</p>
                  <p className="text-[9px] mt-0.5 opacity-70">Please update your profile settings.</p>
                </div>
              )}
            </div>
          )}

          {/* Telegram Handshake (Visible only if Telegram selected) */}
          {channels.telegram && (
            <div className="mt-2 bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 text-[10px] text-blue-200 animate-in fade-in slide-in-from-top-2">
              {!telegramConnected ? (
                <div className="flex flex-col gap-2">
                  {/* Main instruction */}
                  <div className="text-xs font-semibold text-blue-100">
                    📱 Connect Your Telegram
                  </div>

                  {/* Simple 1-step instruction */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                    <p className="font-bold mb-1 text-blue-100">👉 Easiest Way:</p>
                    <button
                      onClick={handleTelegramLink}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 text-xs"
                    >
                      <span>🚀 Click Here → Telegram Opens Automatically</span>
                    </button>
                    <p className="text-[9px] text-blue-300 mt-1 text-center opacity-80">
                      ✨ Just tap "Send" when Telegram opens. That's it!
                    </p>
                    
                    {/* Show popup blocked warning */}
                    {popupBlocked && (
                      <div className="mt-2 bg-orange-500/20 border border-orange-500/40 rounded-lg p-2 text-orange-200 text-[10px] animate-in fade-in">
                        <p className="font-bold">🚫 Popup was blocked!</p>
                        <p className="mt-0.5">✅ Link copied to clipboard - paste in your browser</p>
                        <p className="mt-0.5">📱 Or use the QR code below ↓</p>
                      </div>
                    )}
                  </div>

                  {/* Alternative: QR Code */}
                  <details className="text-[10px] text-gray-400" open={popupBlocked}>
                    <summary className="cursor-pointer hover:text-blue-300 mb-1">
                      📱 Or scan this QR code with your phone
                    </summary>
                    <div className="bg-white p-1 rounded-lg inline-block">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://t.me/${botName}?start=${userId}`}
                        alt="QR Code"
                        className="w-[100px] h-[100px]"
                      />
                    </div>
                    <p className="text-[9px] mt-0.5 opacity-70">
                      Use Google Lens or your camera to scan
                    </p>
                  </details>

                  {/* Manual fallback */}
                  <details className="text-[10px] text-gray-400">
                    <summary className="cursor-pointer hover:text-blue-300">
                      🔧 Advanced: Manual connection
                    </summary>
                    <div className="mt-1 bg-black/20 p-2 rounded border border-white/5">
                      <p className="mb-0.5">Search <b className="text-blue-300">@{botName}</b> in Telegram</p>
                      <p className="mb-0.5">Then send this command:</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <code className="bg-black/40 px-2 py-0.5 rounded text-blue-300 font-mono select-all flex-1">
                          /start {userId}
                        </code>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(`/start ${userId}`)
                          }
                          className="text-[10px] text-gray-500 hover:text-white px-2 py-1 bg-gray-700 rounded"
                          title="Copy Command"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </details>

                  {/* Verify button */}
                  <div className="flex justify-between items-center border-t border-blue-500/20 pt-2 mt-1">
                    <span className="opacity-80 text-[10px]">✅ Done? Verify connection:</span>
                    <button
                      onClick={checkTelegramConnection}
                      disabled={isVerifying}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded-md font-bold transition-all text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isVerifying ? "Checking..." : "Verify"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400 font-bold justify-center py-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Telegram Linked Successfully</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-white/5">
          {mode === "create" && onSkip && (
            <button
              onClick={onSkip}
              className="flex-1 py-2 rounded-xl text-gray-400 hover:text-white font-medium hover:bg-white/5 transition-colors text-sm"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={
              (channels.telegram && !telegramConnected && mode === "create") ||
              (channels.email && !emailVerified)
            }
            className="flex-[2] py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed text-sm"
          >
            {mode === "create" ? "Set Goal & Start" : "Update Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
};
