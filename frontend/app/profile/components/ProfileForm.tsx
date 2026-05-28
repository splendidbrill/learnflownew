"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import { Sidebar } from "@/app/dashboard/Sidebar"; // Adjusted path
import { 
  User as UserIcon, 
  MapPin, 
  GraduationCap, 
  Languages, 
  Save, 
  CheckCircle, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import CreditsSubscriptionCard from "./CreditsSubscriptionCard";

export default function ProfileForm({ user }: { user: User }) {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    age: "",
    school: "",
    grade: "",
    country: "",
    state: "",
    city: "",
    native_language: "",
  });

  useEffect(() => {
    const getProfile = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      try {
        const res = await fetch(`${API_URL}/profile/${user.id}`);
        const data = res.ok ? await res.json() : null;

        if (data) {
          setFormData({
            full_name: data.full_name || user.user_metadata?.full_name || "",
            age: data.age || "",
            school: data.school || "",
            grade: data.grade || "",
            country: data.country || "",
            state: data.state || "",
            city: data.city || "",
            native_language: data.native_language || "",
          });
        } else {
          setFormData(prev => ({
            ...prev,
            full_name: user.user_metadata?.full_name || ""
          }));
        }
      } catch (error) {
        console.log('Error loading user data:', error);
      } finally {
        setFetching(false);
      }
    };

    getProfile();
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

    try {
      const res = await fetch(`${API_URL}/profile/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          updated_at: new Date().toISOString(),
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save profile');
      }
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Error saving profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex h-screen bg-[#13002b] items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#13002b] overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 ml-20 overflow-y-auto h-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6 md:p-10">
        <div className="max-w-4xl mx-auto">
          
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-4xl font-bold text-white mb-2">Complete Your Profile</h1>
            <p className="text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Tell us a bit about yourself so we can personalize your learning journey.
            </p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl shadow-purple-900/20 animate-in fade-in zoom-in duration-500 delay-100">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Personal Info */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-purple-400" />
                  Personal Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                    <input
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:bg-purple-500/5 focus:outline-none transition-all"
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Age</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-purple-500 focus:bg-purple-500/5 focus:outline-none transition-all"
                      placeholder="e.g. 18"
                    />
                  </div>
                </div>
              </div>

              {/* Education */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-cyan-400" />
                  Education
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">School / College</label>
                    <input
                      type="text"
                      name="school"
                      value={formData.school}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:bg-cyan-500/5 focus:outline-none transition-all"
                      placeholder="e.g. Harvard University"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Class / Grade / Year</label>
                    <input
                      type="text"
                      name="grade"
                      value={formData.grade}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:bg-cyan-500/5 focus:outline-none transition-all"
                      placeholder="e.g. Sophomore / 12th Grade"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-pink-400" />
                  Location & Language
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Country</label>
                    <input
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:bg-pink-500/5 focus:outline-none transition-all"
                      placeholder="e.g. USA"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">City</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:bg-pink-500/5 focus:outline-none transition-all"
                      placeholder="e.g. San Francisco"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Languages className="w-3 h-3" /> Native Language
                    </label>
                    <input
                      type="text"
                      name="native_language"
                      value={formData.native_language}
                      onChange={handleChange}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-pink-500 focus:bg-pink-500/5 focus:outline-none transition-all"
                      placeholder="e.g. English"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-6 border-t border-white/10 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative flex items-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Saving..." : <>Save Profile <Save className="w-5 h-5" /></>}
                </button>
              </div>
            </form>
          </div>

          {/* Credits & Subscription Card */}
          <div className="mt-8 animate-in fade-in zoom-in duration-500 delay-200">
            <CreditsSubscriptionCard userId={user.id} />
          </div>
        </div>
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#1e1b2e] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500" />
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Yay! Profile Saved!</h2>
            <p className="text-slate-400 mb-8">
              Your details have been successfully updated.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-white text-purple-900 hover:bg-gray-100 font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              Go to Dashboard <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}