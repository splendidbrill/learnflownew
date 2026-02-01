"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Menu, X, LogOut, LayoutDashboard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js"; // Import Type

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null); // Typed State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const dropdownRef = useRef<HTMLDivElement>(null); // Typed Ref
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    
    if (error) {
      console.error("Error signing in:", error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
    router.push("/");
    router.refresh();
  };

  const handleDashboard = () => {
    setIsDropdownOpen(false);
    router.push("/dashboard");
  };

  const getUserInitial = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const navItems = [
    { name: "Features", href: "#features" },
    { name: "How It Works", href: "#how-it-works" },
    { name: "Pricing", href: "#paid-plans" },
    { name: "Contact", href: "/contact" },
  ];

  const scrollToSection = (href: string) => {
    // 1. Handle Route Navigation (e.g. /contact)
    if (href.startsWith("/")) {
      router.push(href);
      setIsMobileMenuOpen(false);
      return;
    }

    // 2. Handle Scroll (Landing Page)
    // If we are not on the home page, go there first
    if (window.location.pathname !== "/") {
      router.push("/" + href);
      setIsMobileMenuOpen(false);
      return;
    }

    // 3. Normal Scroll
    const element = document.querySelector(href);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setIsMobileMenuOpen(false);
    }
  };

  // ... (The rest of your JSX is perfect, copy it exactly as it was, just ensure the file is named .tsx)
  return (
     <>
      <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "py-3" : "py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between h-16 px-4 sm:px-6">
              {/* Logo */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => {
                  if (window.location.pathname === "/") {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  } else {
                    router.push("/");
                  }
                }}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  LearningFlux
                </span>
              </motion.div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-8 flex-1 justify-center">
                {navItems.map((item, index) => (
                  <motion.button
                    key={item.name}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => scrollToSection(item.href)}
                    className="text-slate-300 hover:text-white transition-colors font-medium text-sm relative group"
                  >
                    {item.name}
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-cyan-400 group-hover:w-full transition-all duration-300" />
                  </motion.button>
                ))}
              </div>

              {/* Auth Section - Desktop */}
              <div className="hidden md:block">
                {loading ? (
                  <div className="w-10 h-10 cursor-pointer rounded-full bg-white/10 animate-pulse" />
                ) : user ? (
                  <div className="relative" ref={dropdownRef}>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="w-10 h-10 rounded-full cursor-pointer bg-blue-600 flex items-center justify-center text-white font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-transparent"
                    >
                      {getUserInitial()}
                    </motion.button>

                    <AnimatePresence>
                      {isDropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                          transition={{ duration: 0.2 }}
                          className="absolute right-0 mt-2 w-56 bg-gradient-to-br from-slate-900/95 to-slate-950/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden"
                        >
                          <div className="p-4 border-b border-white/10">
                            <p className="text-sm text-white font-semibold truncate">
                              {user?.user_metadata?.full_name || user?.email}
                            </p>
                            <p className="text-xs text-slate-400 truncate mt-1">
                              {user?.email}
                            </p>
                          </div>
                          <button
                            onClick={handleDashboard}
                            className="w-full px-4 py-3 cursor-pointer text-left text-sm text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-3 group"
                          >
                            <LayoutDashboard className="w-4 h-4 group-hover:text-purple-400 transition-colors" />
                            <span className="group-hover:text-white  transition-colors">Dashboard</span>
                          </button>
                          <button
                            onClick={handleSignOut}
                            className="w-full px-4 py-3 cursor-pointer text-left  text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3 group"
                          >
                            <LogOut className="w-4 h-4 group-hover:text-red-300 transition-colors" />
                            <span className="group-hover:text-red-300  transition-colors">Logout</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIsModalOpen(true)}
                    className="bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white border border-white/20 backdrop-blur-xl px-6 py-2.5 rounded-lg transition-all duration-200 font-medium"
                  >
                    Sign In
                  </motion.button>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="md:hidden border-t border-white/20 overflow-hidden"
                >
                  <div className="px-4 py-4 space-y-3">
                    {navItems.map((item) => (
                      <motion.button
                        key={item.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => scrollToSection(item.href)}
                        className="block w-full text-left text-slate-300 hover:text-white transition-colors font-medium py-2 px-3 rounded-lg hover:bg-white/10"
                      >
                        {item.name}
                      </motion.button>
                    ))}
                    
                    {/* Mobile Auth Section */}
                    <div className="pt-2">
                      {loading ? (
                        <div className="w-full h-10 rounded-lg bg-white/10 animate-pulse" />
                      ) : user ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                            <p className="text-sm text-white font-semibold truncate">
                              {user?.user_metadata?.full_name || user?.email}
                            </p>
                            <p className="text-xs text-slate-400 truncate mt-1">
                              {user?.email}
                            </p>
                          </div>
                          <button
                            onClick={handleDashboard}
                            className="w-full bg-gradient-to-br cursor-pointer from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white border border-white/20 backdrop-blur-xl px-4 py-2.5 rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Dashboard
                          </button>
                          <button
                            onClick={handleSignOut}
                            className="w-full bg-red-500/10 cursor-pointer hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-lg transition-all duration-200 font-medium flex items-center justify-center gap-2"
                          >
                            <LogOut className="w-4 h-4" />
                            Logout
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setIsModalOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full bg-gradient-to-br from-white/10 to-white/5 hover:from-white/15 hover:to-white/10 text-white border border-white/20 backdrop-blur-xl px-6 py-2.5 rounded-lg transition-all duration-200 font-medium"
                        >
                          Sign In
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.nav>

      {/* Auth Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/20 rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-2">
                    Welcome to LearningFlux
                  </h2>
                  <p className="text-slate-400">
                    Sign in to start your learning journey
                  </p>
                </div>

                <button
                  onClick={handleGoogleSignIn}
                  className="w-full bg-white hover:bg-gray-100 text-gray-900 font-semibold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </button>

                <p className="text-xs text-slate-500 text-center mt-6">
                  By signing in, you agree to our Terms of Service and Privacy Policy
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}