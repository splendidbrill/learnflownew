"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Brain,
  Clock,
  TrendingUp,
  Zap,
  Lock
} from "lucide-react";

interface FeatureItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
}

const features: FeatureItem[] = [
  {
    icon: BookOpen,
    title: "Subject Organization",
    description:
      "Create subjects and organize multiple books under each. Chemistry, Physics, Math - all in one place.",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    icon: Brain,
    title: "Smart Analogies",
    description:
      "AI breaks down complex topics using real-world examples and relatable comparisons you'll remember.",
    gradient: "from-pink-500 to-orange-500"
  },
  {
    icon: Clock,
    title: "Scheduled Lessons",
    description:
      "Set custom learning times. AI delivers lessons automatically when you're most productive.",
    gradient: "from-cyan-500 to-blue-500"
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description:
      "AI remembers what you've learned and builds on previous lessons for continuous improvement.",
    gradient: "from-green-500 to-cyan-500"
  },
  {
    icon: Zap,
    title: "Instant Explanations",
    description:
      "Get explanations for any section instantly. Just ask and AI will break it down for you.",
    gradient: "from-yellow-500 to-orange-500"
  },
  {
    icon: Lock,
    title: "Your Private Tutor",
    description:
      "All your books and progress stay private. Learn at your own pace without judgment.",
    gradient: "from-indigo-500 to-purple-500"
  }
];

export default function Features(): JSX.Element {
  return (
    <div id="features" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-sm mb-6">
            <span className="text-sm text-cyan-300">Everything You Need</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Powerful Features
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            All the tools you need to master any subject, anytime
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 h-full hover:bg-white/10">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-300`}
                />

                <div className="relative">
                  <div
                    className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                  >
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-xl font-semibold text-white mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
