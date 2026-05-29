"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/landing/Navbar";
import { Brain, Send, CheckCircle, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    isCustomer: "no",
    plan: "Free ($0/mo)",
    email: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  // Prefill email if logged in
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setFormData((prev) => ({ ...prev, email: user.email! }));
      }
    };
    getUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to send message. Please try again.");
      }

      setSuccess(true);
      setFormData((prev) => ({
        ...prev,
        message: "", // Clear message only
      }));
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0118] text-white">
      <Navbar />
      
      <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl relative overflow-hidden">
          
          {/* Success Overlay */}
          {success ? (
            <div className="absolute inset-0 z-20 bg-[#0A0118]/95 flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border border-green-500/30">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">Message Sent!</h2>
              <p className="text-slate-400 max-w-md mb-8 text-lg">
                Thanks for reaching out! We've received your message and will get back to you at <strong>{formData.email}</strong> shortly.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform"
              >
                Send Another Message
              </button>
            </div>
          ) : null}

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-4">
              Get in Touch
            </h1>
            <p className="text-slate-400 text-lg">
              Have questions? We'd love to hear from you.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300 ml-1">First Name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300 ml-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Customer Status Radio */}
            <div className="space-y-3 bg-white/5 rounded-xl p-4 border border-white/5">
              <label className="text-sm font-semibold text-slate-300">Are you a customer?</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${formData.isCustomer === "yes" ? "border-purple-500 bg-purple-500/20" : "border-slate-600 group-hover:border-slate-400"}`}>
                    {formData.isCustomer === "yes" && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                  </div>
                  <input
                    type="radio"
                    className="hidden"
                    name="isCustomer"
                    value="yes"
                    checked={formData.isCustomer === "yes"}
                    onChange={(e) => setFormData({ ...formData, isCustomer: e.target.value })}
                  />
                  <span className={formData.isCustomer === "yes" ? "text-white font-medium" : "text-slate-400 group-hover:text-slate-300"}>
                    Already a customer
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${formData.isCustomer === "no" ? "border-purple-500 bg-purple-500/20" : "border-slate-600 group-hover:border-slate-400"}`}>
                    {formData.isCustomer === "no" && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
                  </div>
                  <input
                    type="radio"
                    className="hidden"
                    name="isCustomer"
                    value="no"
                    checked={formData.isCustomer === "no"}
                    onChange={(e) => setFormData({ ...formData, isCustomer: e.target.value })}
                  />
                  <span className={formData.isCustomer === "no" ? "text-white font-medium" : "text-slate-400 group-hover:text-slate-300"}>
                    Not a customer yet
                  </span>
                </label>
              </div>
            </div>

            {/* Plan Selection (Conditional) */}
            {formData.isCustomer === "yes" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-semibold text-purple-300 ml-1">Which plan are you on?</label>
                <select
                  value={formData.plan}
                  onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                  className="w-full bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 outline-none transition-all text-white appearance-none cursor-pointer"
                >
                  <option value="Free ($0/month)" className="bg-slate-900">Free ($0/month)</option>
                  <option value="Scholar" className="bg-slate-900">Scholar</option>
                  <option value="Master" className="bg-slate-900">Master</option>
                  <option value="Elite" className="bg-slate-900">Elite</option>
                </select>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 ml-1">Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600"
                placeholder="john@example.com"
              />
            </div>

            {/* Message Field */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 ml-1">Message</label>
              <textarea
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600 resize-none"
                placeholder="How can we help you?"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-400 animate-in fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Send Message</span>
                  <Send className="w-5 h-5" />
                </>
              )}
            </button>

          </form>
        </div>
      </div>
    </div>
  );
}
