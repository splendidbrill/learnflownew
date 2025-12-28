"use client";
import React, { useState } from 'react';
import { X, Bell, Mail, Send, Clock, CheckCircle } from 'lucide-react';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (time: string, method: 'email' | 'telegram') => void;
  onSkip?: () => void; // Optional because Edit Mode doesn't have "Skip"
  mode: 'create' | 'edit';
  userId: string;
  botName: string; // e.g. "LearnFlowBot"
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({ 
  isOpen, onClose, onSave, onSkip, mode, userId, botName 
}) => {
  const [time, setTime] = useState("09:00");
  const [method, setMethod] = useState<'email' | 'telegram'>('telegram');
  const [isConnected, setIsConnected] = useState(false); // Fake check for MVP

  if (!isOpen) return null;

  const handleConnectTelegram = () => {
    // Open Telegram Deep Link in new tab
    window.open(`https://t.me/${botName}?start=${userId}`, '_blank');
    // In real app, you'd poll the DB to see if chat_id appeared.
    // For MVP, we assume they did it after clicking.
    setIsConnected(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e0a3c] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-400">
            <Bell className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {mode === 'create' ? 'Build a Learning Habit' : 'Edit Study Schedule'}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            "Consistency is key. Even 5 minutes a day makes you 44% better in a year."
          </p>
        </div>

        {/* 1. Time Picker */}
        <div className="space-y-4 mb-6">
          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pick a time (Daily)
          </label>
          <input 
            type="time" 
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white text-lg focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* 2. Method Picker */}
        <div className="space-y-3 mb-8">
          <label className="text-sm font-medium text-gray-300">Notification Method</label>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setMethod('telegram')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                method === 'telegram' 
                ? 'bg-blue-500/20 border-blue-500 text-blue-200' 
                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
              }`}
            >
              <Send className="w-5 h-5" />
              <span className="text-xs font-bold">Telegram</span>
            </button>

            <button 
              onClick={() => setMethod('email')}
              className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                method === 'email' 
                ? 'bg-purple-500/20 border-purple-500 text-purple-200' 
                : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
              }`}
            >
              <Mail className="w-5 h-5" />
              <span className="text-xs font-bold">Email</span>
            </button>
          </div>

          {/* Telegram Handshake Info */}
          {method === 'telegram' && (
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-200">
              {!isConnected ? (
                <div className="flex justify-between items-center">
                  <span>Bot needs permission to msg you.</span>
                  <button 
                    onClick={handleConnectTelegram}
                    className="bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded font-bold transition-colors"
                  >
                    Connect
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Bot Connected!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {mode === 'create' && onSkip && (
            <button 
              onClick={onSkip}
              className="flex-1 py-3 rounded-xl text-gray-400 hover:text-white font-medium hover:bg-white/5 transition-colors"
            >
              Skip for now
            </button>
          )}
          <button 
            onClick={() => onSave(time, method)}
            className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold shadow-lg hover:shadow-purple-500/20 transition-all hover:scale-[1.02]"
          >
            {mode === 'create' ? 'Set Goal & Start' : 'Update Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
};