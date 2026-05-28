"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Check, 
  Sparkles, 
  Coins, 
  Crown, 
  Loader2, 
  ArrowLeft,
  AlertCircle,
  CreditCard
} from "lucide-react";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/app/dashboard/Sidebar";

// Declare Razorpay type for TypeScript
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface PricingPageProps {
  user: User;
}

interface Plan {
  name: string;
  value: string;
  price: string;
  priceNum: number;
  priceInr: number; // Price in INR
  priceInrDisplay: string;
  period: string;
  description: string;
  features: string[];
  credits: number;
  popular: boolean;
}

const plans: Plan[] = [
  {
    name: "Scholar",
    value: "scholar",
    price: "$20",
    priceNum: 20,
    priceInr: 1700,
    priceInrDisplay: "₹1,700",
    period: "per month",
    description: "Individual Students",
    features: [
      "Personalized Analogy Engine",
      "100 Books/Month",
      "5 Subject Profiles",
      "450 Diagrams/Month (15/hr)",
      "Personal Dashboard",
      "Standard Scheduling",
      "Basic History Tracking",
      "Unlimited Lessons (edge-tts)",
      "Email Support"
    ],
    credits: 200,
    popular: false
  },
  {
    name: "Master",
    value: "master",
    price: "$49",
    priceNum: 49,
    priceInr: 4200,
    priceInrDisplay: "₹4,200",
    period: "per month",
    description: "Power Learners",
    features: [
      "Advanced AI Analogies",
      "220 Books/Month",
      "Unlimited Subjects",
      "1000 Diagrams/Month",
      "Personal Dashboard",
      "Schedule Custom Times",
      "Progress Tracking",
      "Unlimited Lessons",
      "Priority Support"
    ],
    credits: 500,
    popular: true
  },
  {
    name: "Elite",
    value: "elite",
    price: "$99",
    priceNum: 99,
    priceInr: 8400,
    priceInrDisplay: "₹8,400",
    period: "per month",
    description: "Teams & Groups",
    features: [
      "Everything in Master",
      "450 Books/Month",
      "Unlimited Subjects",
      "Unlimited Diagrams",
      "Premium Neural Voice",
      "Personal Dashboard",
      "Team Analytics (Coming Soon)",
      "High-res Reconstructions",
      "Dedicated Support"
    ],
    credits: 1000,
    popular: false
  }
];

const TIER_ORDER = ["explorer", "scholar", "master", "elite"];

// INR prices for upgrade calculation
const TIER_PRICES_INR: Record<string, number> = {
  explorer: 0,
  scholar: 1700,
  master: 4200,
  elite: 8400
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function PricingPage({ user }: PricingPageProps) {
  const router = useRouter();
  const [credits, setCredits] = useState(0);
  const [currentTier, setCurrentTier] = useState("explorer");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const res = await fetch(`${API_URL}/user/balance/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setCredits(data.credits || 0);
          setCurrentTier(data.subscription_tier || "explorer");
        }
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [user.id]);

  // Load Razorpay checkout script
  const loadRazorpayScript = useCallback(() => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }, []);

  // Handle Razorpay payment
  const handlePurchase = async (plan: Plan) => {
    setError(null);
    setSuccess(null);
    setPurchasing(plan.value);

    try {
      // 1. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Payment gateway failed to load");
      }

      // 2. Create order on backend
      const orderRes = await fetch(`${API_URL}/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          tier: plan.value
        })
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderData.detail || "Failed to create order");
      }

      // 3. Open Razorpay checkout
      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: orderData.name,
        description: orderData.description,
        order_id: orderData.order_id,
        prefill: orderData.prefill,
        theme: {
          color: "#9333ea" // Purple theme
        },
        handler: async (response: any) => {
          // 4. Verify payment on backend
          try {
            const verifyRes = await fetch(`${API_URL}/payment/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                user_id: user.id,
                tier: plan.value
              })
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.detail || "Payment verification failed");
            }

            setSuccess(`Successfully upgraded to ${plan.name}!`);
            setCurrentTier(plan.value);

            // Redirect after success
            setTimeout(() => {
              router.push("/profile");
            }, 2000);

          } catch (err: any) {
            setError(err.message || "Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            setPurchasing(null);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (err: any) {
      setError(err.message || "Failed to initiate payment");
      setPurchasing(null);
    }
  };

  const currentTierIndex = TIER_ORDER.indexOf(currentTier);

  // Can purchase if tier is higher than current (payment via Razorpay, no credits needed)
  const canPurchase = (plan: Plan) => {
    const planTierIndex = TIER_ORDER.indexOf(plan.value);
    return planTierIndex > currentTierIndex;
  };

  // Calculate upgrade price (pay the difference)
  const getUpgradePrice = (plan: Plan): { amount: number; display: string } => {
    const currentPrice = TIER_PRICES_INR[currentTier] || 0;
    const targetPrice = plan.priceInr;
    const upgradeAmount = targetPrice - currentPrice;
    return {
      amount: upgradeAmount,
      display: `₹${upgradeAmount.toLocaleString('en-IN')}`
    };
  };

  const getPlanStatus = (plan: Plan) => {
    const planTierIndex = TIER_ORDER.indexOf(plan.value);
    
    if (planTierIndex <= currentTierIndex) {
      return planTierIndex === currentTierIndex ? "current" : "owned";
    }
    
    return "available";
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-[#13002b] items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#13002b] overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 ml-20 overflow-y-auto h-full bg-gradient-to-br from-[#13002b] via-[#1e0a3c] to-[#0f0518] p-6 md:p-10">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <Link 
                href="/profile" 
                className="text-purple-400 hover:text-purple-300 flex items-center gap-2 text-sm mb-2"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Profile
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold text-white">Upgrade Your Plan</h1>
              <p className="text-slate-400 mt-1">Use your credits to unlock premium features</p>
            </div>

            {/* Credits Badge */}
            <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/10 px-6 py-3 rounded-2xl border border-amber-500/30">
              <div className="flex items-center gap-3">
                <Coins className="w-6 h-6 text-amber-400" />
                <div>
                  <p className="text-xs text-amber-300/70">Your Credits</p>
                  <p className="text-2xl font-bold text-amber-400">{credits}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Plan Banner */}
          {currentTier !== "explorer" && (
            <div className="mb-8 bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 flex items-center gap-3">
              <Crown className="w-6 h-6 text-purple-400" />
              <span className="text-purple-300">
                You currently have the <span className="font-bold capitalize">{currentTier}</span> plan
              </span>
            </div>
          )}

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-3 text-red-400">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3 text-green-400">
              <Check className="w-5 h-5" />
              {success}
            </div>
          )}

          {/* Plans Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan, index) => {
              const status = getPlanStatus(plan);

              return (
                <motion.div
                  key={plan.value}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
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
                        : "border-white/10"
                    } ${status === "current" ? "ring-2 ring-green-500/50" : ""}`}
                  >
                    {status === "current" && (
                      <div className="absolute top-4 right-4 bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full">
                        Current Plan
                      </div>
                    )}

                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <p className="text-slate-400 text-sm mb-6">{plan.description}</p>

                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-5xl font-bold text-white">{plan.price}</span>
                        <span className="text-slate-400">/ {plan.period}</span>
                      </div>

                      {/* INR Price */}
                      <div className="flex items-center gap-2 bg-purple-500/10 px-4 py-2 rounded-xl border border-purple-500/20">
                        <CreditCard className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 font-medium">
                          Pay {plan.priceInrDisplay}
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-4 mb-8">
                      {plan.features.slice(0, 6).map((feature, fIndex) => (
                        <li key={fIndex} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                          <span className="text-slate-300 text-sm">{feature}</span>
                        </li>
                      ))}
                      {plan.features.length > 6 && (
                        <li className="text-slate-500 text-sm pl-8">
                          +{plan.features.length - 6} more features
                        </li>
                      )}
                    </ul>

                    <button
                      onClick={() => handlePurchase(plan)}
                      disabled={!canPurchase(plan) || purchasing !== null}
                      className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
                        status === "current"
                          ? "bg-green-500/20 text-green-400 cursor-default"
                          : status === "owned"
                          ? "bg-gray-500/20 text-gray-400 cursor-default"
                          : canPurchase(plan)
                          ? "bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white shadow-lg shadow-purple-500/30 hover:scale-[1.02]"
                          : "bg-white/10 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      {purchasing === plan.value ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : status === "current" ? (
                        "Your Current Plan"
                      ) : status === "owned" ? (
                        "Already Owned"
                      ) : canPurchase(plan) ? (
                        <>
                          <CreditCard className="w-5 h-5" />
                          {currentTier === "explorer" 
                            ? `Subscribe for ${plan.priceInrDisplay}`
                            : `Upgrade for ${getUpgradePrice(plan).display}`
                          }
                        </>
                      ) : (
                        "Not Available"
                      )}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Help Section */}
          <div className="mt-12 text-center">
            <p className="text-slate-400">
              Need more credits? Contact support or check for promotional offers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
