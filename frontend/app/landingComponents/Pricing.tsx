"use client";

import React from "react";
import { motion } from "framer-motion";

import { Button } from "./button";
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
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out LearnFlow",
    features: [
      "1 Subject",
      "2 Books per subject",
      "Basic AI explanations",
      "10 lessons per month",
      "Community support"
    ],
    cta: "Start Free",
    popular: false
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For serious learners",
    features: [
      "Unlimited subjects",
      "Unlimited books",
      "Advanced AI analogies",
      "Unlimited lessons",
      "Schedule custom times",
      "Progress tracking",
      "Priority support",
      "Export notes"
    ],
    cta: "Start Pro Trial",
    popular: true
  },
  {
    name: "Team",
    price: "$49",
    period: "per month",
    description: "Perfect for study groups",
    features: [
      "Everything in Pro",
      "Up to 5 team members",
      "Shared subjects & books",
      "Group study sessions",
      "Admin dashboard",
      "Dedicated support",
      "Custom integrations"
    ],
    cta: "Contact Sales",
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

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
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
          <p className="text-slate-400">
            All plans include a 14-day money-back guarantee. No questions asked.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
