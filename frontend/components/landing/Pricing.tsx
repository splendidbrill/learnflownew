"use client";

import React from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

const plans: Plan[] = [
  {
    name: "Scholar",
    price: "$20",
    period: "per month",
    description: "Individual Students",
    features: [
      "Personalized Analogy Engine",
      "Unlimited PDF Pages",
      "5 Subject Profiles",
      "Unlimited Lessons (edge-tts)",
      "Personal Dashboard",
      "Standard Scheduling",
      "Basic History Tracking",
      "Individual Collaboration",
      "Unlimited Diagram Analysis (Gemini 3)",
      "Email Support"
    ],
    cta: "Start Scholar",
    popular: false
  },
  {
    name: "Master",
    price: "$49",
    period: "per month",
    description: "Power Learners",
    features: [
      "Advanced AI Analogies",
      "Unlimited PDF Books",
      "Unlimited Subjects",
      "Unlimited Lessons",
      "Personal Dashboard",
      "Schedule Custom Times",
      "Progress Tracking",
      "Individual Collaboration",
      "Unlimited + AI Redraw",
      "Priority Support"
    ],
    cta: "Start Master",
    popular: true
  },
  {
    name: "Elite",
    price: "$99",
    period: "per month",
    description: "Teams & Groups",
    features: [
      "Everything in Master",
      "Shared Books & Subjects (Coming Soon)",
      "Unlimited Subjects",
      "Premium Neural Voice",
      "Personal Dashboard",
      "Group Study (Coming Soon)",
      "Team Analytics",
      "Up to 5 Team Members (Coming Soon)",
      "High-res Reconstructions",
      "Dedicated Support"
    ],
    cta: "Start Elite",
    popular: false
  }
];

export default function Pricing(): JSX.Element {
  return (
    <div id="pricing" className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 backdrop-blur-sm mb-6">
            <span className="text-sm text-purple-300">Simple Pricing</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Choose Your Plan
          </h2>

          <p className="text-xl text-slate-400 max-w-2xl mx-auto">
            Start free, upgrade when you're ready
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative mb-12"
        >
          <div className="relative bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300">
            <div className="grid md:grid-cols-4 gap-8 items-center">
              <div className="md:col-span-1">
                <h3 className="text-2xl font-bold text-white mb-2">Free</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">$0</span>
                  <span className="text-slate-400">/ Month</span>
                </div>
                <p className="text-slate-400 text-sm mt-2">
                  Perfect for trying out LearnFlow
                </p>
                <Button className="w-full mt-6 py-8 text-xl font-bold rounded-xl bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white shadow-lg shadow-purple-500/30">
                  Get Started
                </Button>
              </div>

              <div className="md:col-span-3 grid sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" /> Analogy Engine
                  </h4>
                  <p className="text-slate-400 text-sm">Basic Text-only analogies</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400" /> Dashboard
                  </h4>
                  <p className="text-slate-400 text-sm">Personal Dashboard for all users</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400" /> Limits
                  </h4>
                  <p className="text-slate-400 text-sm">10 PDF pages per file | 1 Subject profile</p>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400" /> Daily Access
                  </h4>
                  <p className="text-slate-400 text-sm">5 Voice lessons | 3 Diagram analyses</p>
                </div>
                <div className="sm:col-span-2">
                  <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                    <Check className="w-4 h-4 text-purple-400" /> Support
                  </h4>
                  <p className="text-slate-400 text-sm">Access to student community support</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div id="paid-plans" className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <div className="flex items-center gap-1 px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-semibold">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}

              <div
                className={`relative h-full bg-white/5 backdrop-blur-sm rounded-3xl p-8 border transition-all duration-300 ${
                  plan.popular
                    ? "border-purple-500/50 scale-105 bg-white/10"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {plan.name}
                  </h3>

                  <p className="text-slate-400 text-sm mb-6">
                    {plan.description}
                  </p>

                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">
                      {plan.price}
                    </span>
                    <span className="text-slate-400">/ {plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-white" />
                      </div>

                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full py-6 rounded-xl text-lg ${
                    plan.popular
                      ? "bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white shadow-lg shadow-purple-500/30"
                      : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                  }`}
                >
                  {plan.cta}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          {/* <p className="text-slate-400">
            All plans include a 14-day money-back guarantee. No questions asked.
          </p> */}
        </motion.div>
      </div>
    </div>
  );
}
