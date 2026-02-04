"use client";

import React from "react";
import { motion } from "framer-motion";
import { Target, Flame, Users, Trophy } from "lucide-react";

interface StatItem {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
}

export default function Benefits(): JSX.Element {
  const stats: StatItem[] = [
    { icon: Target, value: "95%", label: "Better Understanding" },
    { icon: Flame, value: "3x", label: "Faster Learning" },
    { icon: Users, value: "10+", label: "Active Students" },
    { icon: Trophy, value: "4.9/5", label: "Student Rating" }
  ];

  const testimonials: Testimonial[] = [
    {
      quote:
        "The analogies are brilliant! I finally understand organic chemistry concepts that confused me for months.",
      author: "Akrist Raj",
      role: "Chemistry Student"
    },
    {
      quote:
        "Scheduling lessons at 9pm works perfectly with my routine. The AI remembers everything I've learned.",
      author: "Sayukta Karan",
      role: "Engineering Major"
    },
    {
      quote:
        "Being able to organize all my subjects and books in one place is a game-changer. Love this platform!",
      author: "Aman Jaiswal",
      role: "Medical Student"
    }
  ];

  return (
    <div className="relative py-32 px-6 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-900/20 to-transparent" />

      <div className="max-w-7xl mx-auto relative">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Why Students Love LearningFlux
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Real results from real learners
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0.8, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 text-center"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-6 h-6 text-white" />
              </div>

              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                {stat.value}
              </div>

              <div className="text-slate-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10"
            >
              <div className="text-yellow-400 text-2xl mb-4">★★★★★</div>

              <p className="text-slate-300 mb-6 leading-relaxed">
                "{t.quote}"
              </p>

              <div>
                <div className="text-white font-semibold">{t.author}</div>
                <div className="text-slate-400 text-sm">{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
