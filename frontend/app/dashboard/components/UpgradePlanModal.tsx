"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Crown, ArrowUpRight, AlertCircle } from "lucide-react";
import Link from "next/link";

interface UpgradePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  limit: number;
  currentTier: string;
}

export const UpgradePlanModal: React.FC<UpgradePlanModalProps> = ({
  isOpen,
  onClose,
  featureName,
  limit,
  currentTier,
}) => {
  if (!isOpen) return null;

  // Format tier name for display
  const tierDisplay = currentTier.charAt(0).toUpperCase() + currentTier.slice(1);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-gradient-to-br from-[#1e1b2e] to-[#2a2440] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        >
          {/* Header with gradient accent */}
          <div className="relative bg-gradient-to-r from-purple-600/20 to-pink-600/20 p-6 pb-4">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
            
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Limit Reached</h2>
                <p className="text-purple-300/70 text-sm">Upgrade for more</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 pt-4">
            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
              <p className="text-gray-300 text-center">
                Your <span className="font-semibold text-purple-400">{tierDisplay}</span> plan only allows
              </p>
              <p className="text-3xl font-bold text-white text-center mt-2">
                {limit} {featureName}
              </p>
            </div>

            <p className="text-gray-400 text-sm text-center mb-6">
              Upgrade your plan to unlock more {featureName.toLowerCase()} and additional premium features.
            </p>

            {/* Current Plan Indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <Crown className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">
                Current: <span className="text-purple-400 font-medium">{tierDisplay}</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
              >
                Maybe Later
              </button>
              <Link
                href="/pricing"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all shadow-lg shadow-purple-900/30 hover:scale-[1.02]"
                onClick={onClose}
              >
                Upgrade Plan
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
