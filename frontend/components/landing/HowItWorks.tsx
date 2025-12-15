"use client";

import React from "react";
import { motion } from "framer-motion";
import { Upload, MessageSquare, Lightbulb, Calendar } from "lucide-react";

interface StepItem {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  color: string;
}

const steps: StepItem[] = [
  {
    icon: Upload,
    title: "Upload Your Books",
    description:
      "Simply upload any PDF textbook or study material. Organize them by subjects for easy access.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: MessageSquare,
    title: "Chat & Learn",
    description:
      "Ask AI to explain any chapter, concept, or section. Get breakdowns in simple, relatable terms.",
    color: "from-pink-500 to-cyan-500"
  },
  {
    icon: Lightbulb,
    title: "Understand with Analogies",
    description:
      "Complex concepts become crystal clear with real-world analogies and examples you can relate to.",
    color: "from-cyan-500 to-purple-500"
  },
  {
    icon: Calendar,
    title: "Schedule Your Learning",
    description:
      "Set up automated lessons at your preferred time. AI keeps track of your progress automatically.",
    color: "from-purple-500 to-pink-500"
  }
];

export default function HowItWorks(): JSX.Element {
  return (
    <div className="relative py-32 px-6 overflow-hidden">
      <div id="how-it-works" className="max-w-7xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm mb-6">
            <span className="text-sm text-purple-300">Simple Process</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            How It Works
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Four simple steps to transform how you learn
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative group"
            >
              <div className="relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 h-full">
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {index + 1}
                </div>

                <div
                  className={`w-16 h-16 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  <step.icon className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-xl font-semibold text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-white/20 to-transparent" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
