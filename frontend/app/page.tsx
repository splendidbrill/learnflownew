// "use client";

// import React, { useState, useEffect } from "react";
// import { motion } from "framer-motion";
// import { ArrowRight, Sparkles, BookOpen, Brain, Github } from "lucide-react";
// import { supabase } from "@/lib/supabase/client";
// import { useRouter } from "next/navigation";

// export default function Hero() {
//   const router = useRouter();
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     // Redirect if already logged in
//     const checkUser = async () => {
//       const { data: { session } } = await supabase.auth.getSession();
//       if (session) router.push("/dashboard");
//     };
//     checkUser();
//   }, [router]);

//   const handleLogin = async () => {
//     setLoading(true);
//     // Uses Github or Google depending on what you enabled in Supabase
//     // If you haven't set up OAuth, we can switch to Email/Password
//     const { error } = await supabase.auth.signInWithOAuth({
//       provider: 'google', // Change to 'github' if you prefer
//       options: {
//         redirectTo: `${window.location.origin}/auth/callback`,
//       },
//     });
//     if (error) {
//         alert("Login Error: " + error.message);
//         setLoading(false);
//     }
//   };

//   return (
//     <div className="relative min-h-screen bg-slate-950 overflow-hidden text-white flex flex-col justify-center">
//       {/* Background Ambience */}
//       <div className="absolute inset-0 overflow-hidden pointer-events-none">
//         <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
//         <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
//       </div>

//       <div className="relative max-w-7xl mx-auto px-6 w-full">
//         <div className="grid lg:grid-cols-2 gap-12 items-center">
//           <div>
//             <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
//               <Sparkles className="w-4 h-4 text-purple-400" />
//               <span className="text-sm text-purple-300">AI-Powered Learning</span>
//             </div>

//             <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
//               Learn Anything,
//               <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
//                 {" "}Understand Everything
//               </span>
//             </h1>

//             <p className="text-xl text-slate-300 mb-8 max-w-lg">
//               Upload your textbooks. Our AI breaks them down using analogies you actually care about.
//             </p>

//             <button 
//               onClick={handleLogin}
//               disabled={loading}
//               className="bg-white text-slate-950 text-lg px-8 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
//             >
//               {loading ? "Connecting..." : "Start Learning Free"}
//               <ArrowRight className="w-5 h-5" />
//             </button>
//           </div>

//           {/* Visual Card */}
//           <motion.div 
//             initial={{ opacity: 0, scale: 0.9 }}
//             animate={{ opacity: 1, scale: 1 }}
//             className="hidden lg:block bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl"
//           >
//             <div className="flex items-center gap-3 mb-6">
//               <BookOpen className="w-6 h-6 text-purple-400" />
//               <span className="font-semibold">Physics 101</span>
//             </div>
//             <div className="space-y-4">
//               <div className="h-2 bg-white/10 rounded w-full" />
//               <div className="h-2 bg-white/10 rounded w-5/6" />
//               <div className="p-4 bg-purple-500/20 rounded-xl border border-purple-500/30">
//                 <div className="flex items-center gap-2 text-purple-300 text-sm mb-2">
//                   <Brain className="w-4 h-4" />
//                   <span>AI Explanation</span>
//                 </div>
//                 <p className="text-sm text-slate-300">
//                   Think of voltage like water pressure in a pipe...
//                 </p>
//               </div>
//             </div>
//           </motion.div>
//         </div>
//       </div>
//     </div>
//   );
// }

// import Navbar from "./landingComponents/Navbar";
// import Hero from "./landingComponents/Hero";
// import HowItWorks from "./landingComponents/HowItWorks";
// import Features from "./landingComponents/Features";
// import Benefits from "./landingComponents/Benefits";
// import Pricing from "./landingComponents/Pricing";
// // import Footer from "./landingComponents/Footer";

// export default function Home(): JSX.Element {
//   return (
//     <div className="bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 min-h-screen">
//       <Navbar />
//       <Hero />
//       <HowItWorks />
//       <Features />
//       <Benefits />
//       <Pricing />
//       {/* <Footer /> */}
//     </div>
//   );
// }
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/learningflux");
}