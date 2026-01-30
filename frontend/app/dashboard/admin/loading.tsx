"use client";

import { motion } from "framer-motion";

export default function Loading() {
  return (
    <div className="flex h-screen bg-[#13002b] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-purple-500/20"></div>
          <div className="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-transparent border-t-purple-500 animate-spin"></div>
        </div>
        <p className="text-slate-400 text-sm">Loading admin panel...</p>
      </motion.div>
    </div>
  );
}
