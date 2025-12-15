// "use client";

// import React, { useState, useRef, useEffect } from "react";
// import {
//   LogOut,
//   Home,
//   User as UserIcon,
//   ChevronRight,
//   ChevronLeft,
//   LayoutDashboard,
// } from "lucide-react";

// import { createClient } from "@/lib/supabase/client";
// import { useRouter, usePathname } from "next/navigation";
// import Link from "next/link";
// import { User } from "@supabase/supabase-js";

// export const Sidebar: React.FC = () => {
//   const [isCollapsed, setIsCollapsed] = useState(true);
//   const [isMenuOpen, setIsMenuOpen] = useState(false);
//   const [user, setUser] = useState<User | null>(null);

//   const menuRef = useRef<HTMLDivElement>(null);
//   const router = useRouter();
//   const pathname = usePathname();
//   const supabase = createClient();

//   // Load authenticated user on mount
//   useEffect(() => {
//     supabase.auth.getUser().then(({ data }) => {
//       setUser(data.user ?? null);
//     });
//   }, []);

//   const userInitial = user?.email ? user.email[0].toUpperCase() : "U";

//   useEffect(() => {
//     const handleClickOutside = (event: MouseEvent) => {
//       if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
//         setIsMenuOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   const handleSignOut = async () => {
//     await supabase.auth.signOut();
//     router.push("/");
//     router.refresh();
//   };

//   return (
//     <div
//       className={`fixed left-0 top-0 h-full bg-[#0f0518] border-r border-white/10 transition-all duration-300 z-50 flex flex-col ${
//         isCollapsed ? "w-20" : "w-64"
//       }`}
//     >
//       {/* Header */}
//       <div className="p-6 flex items-center justify-between border-b border-white/5">
//         {!isCollapsed && (
//           <div className="flex items-center gap-3 animate-in fade-in duration-200">
//             <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center shrink-0">
//               <span className="text-white font-bold">L</span>
//             </div>
//             <span className="font-bold text-white">LearnFlow</span>
//           </div>
//         )}

//         {isCollapsed && (
//           <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto">
//             <span className="text-white font-bold">L</span>
//           </div>
//         )}

//         <button
//           onClick={() => setIsCollapsed(!isCollapsed)}
//           className={`text-gray-400 hover:text-white transition-colors ${
//             isCollapsed
//               ? "absolute -right-3 top-8 bg-[#1e1b2e] border border-white/10 rounded-full p-1"
//               : ""
//           }`}
//         >
//           {isCollapsed ? (
//             <ChevronRight className="w-3 h-3" />
//           ) : (
//             <ChevronLeft className="w-5 h-5" />
//           )}
//         </button>
//       </div>

//       {/* Navigation */}
//       <div className="flex-1 py-6 px-4 space-y-2">
//         <Link
//           href="/dashboard"
//           className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
//             pathname === "/dashboard" || pathname.startsWith("/dashboard")
//               ? "bg-purple-600/10 text-purple-300 border border-purple-600/20"
//               : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
//           }`}
//         >
//           <LayoutDashboard className="w-5 h-5 shrink-0" />
//           {!isCollapsed && <span className="font-medium truncate">Dashboard</span>}
//         </Link>

//         <Link
//           href="/profile"
//           className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
//             pathname === "/profile"
//               ? "bg-purple-600/10 text-purple-300 border border-purple-600/20"
//               : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
//           }`}
//         >
//           <UserIcon className="w-5 h-5 shrink-0" />
//           {!isCollapsed && <span className="font-medium truncate">My Profile</span>}
//         </Link>
//       </div>

//       {/* User Footer */}
//       <div className="p-4 border-t border-white/5 relative" ref={menuRef}>
//         <button
//           onClick={() => setIsMenuOpen(!isMenuOpen)}
//           className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all ${
//             isMenuOpen ? "bg-white/5" : ""
//           } ${isCollapsed ? "justify-center" : ""}`}
//         >
//           <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-[#0f0518] shadow-lg shrink-0">
//             <span className="text-white font-bold text-lg">{userInitial}</span>
//           </div>

//           {!isCollapsed && (
//             <div className="flex-1 text-left overflow-hidden">
//               <p className="text-sm font-medium text-white truncate">
//                 {user?.email?.split("@")[0] || "Loading..."}
//               </p>
//               <p className="text-xs text-gray-500 truncate">Free Plan</p>
//             </div>
//           )}
//         </button>

//         {/* Dropdown */}
//         {isMenuOpen && (
//           <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1e1b2e] border border-white/10 rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 min-w-[200px]">
//             <div className="py-1">
//               <Link
//                 href="/profile"
//                 onClick={() => setIsMenuOpen(false)}
//                 className="px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
//               >
//                 <UserIcon className="w-4 h-4" /> Profile
//               </Link>

//               <Link
//                 href="/dashboard"
//                 onClick={() => setIsMenuOpen(false)}
//                 className="px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
//               >
//                 <LayoutDashboard className="w-4 h-4" /> Dashboard
//               </Link>

//               <Link
//                 href="/"
//                 className="px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 flex items-center gap-2"
//               >
//                 <Home className="w-4 h-4" /> Home
//               </Link>

//               <button
//                 onClick={handleSignOut}
//                 className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
//               >
//                 <LogOut className="w-4 h-4" /> Sign Out
//               </button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

"use client";
import React, { useState, useRef, useEffect } from 'react';
import { 
  LogOut, 
  Home, 
  User as UserIcon, 
  ChevronRight, 
  ChevronLeft,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client"; 
import { useRouter, usePathname } from "next/navigation"; 
import Link from "next/link";
import { User } from '@supabase/supabase-js';

interface SidebarProps {
  user: User;
}

export const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const userInitial = user.email ? user.email[0].toUpperCase() : 'U';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div 
      className={`fixed left-0 top-0 h-full bg-[#0f0518] border-r border-white/10 transition-all duration-300 z-50 flex flex-col ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-6 flex items-center justify-between border-b border-white/5">
        {!isCollapsed && (
          <div className="flex items-center gap-3 animate-in fade-in duration-200">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold">L</span>
            </div>
            <span className="font-bold text-white">LearnFlow</span>
          </div>
        )}
        {isCollapsed && (
           <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center mx-auto">
             <span className="text-white font-bold">L</span>
           </div>
        )}
        
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`text-gray-400 hover:text-white transition-colors ${isCollapsed ? 'absolute -right-3 top-8 bg-[#1e1b2e] border border-white/10 rounded-full p-1' : ''}`}
        >
          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-6 px-4 space-y-2">
        
        {/* Dashboard Link */}
        <Link 
          href="/dashboard"
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
            pathname === '/dashboard' || pathname === '/dashboard/'
              ? 'bg-purple-600/10 text-purple-300 border border-purple-600/20' 
              : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="font-medium truncate animate-in fade-in">Dashboard</span>}
        </Link>

        {/* Profile Link */}
        <Link 
          href="/profile"
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group ${
            pathname === '/profile' 
              ? 'bg-purple-600/10 text-purple-300 border border-purple-600/20' 
              : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
          }`}
        >
          <UserIcon className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="font-medium truncate animate-in fade-in">My Profile</span>}
        </Link>

      </div>

      {/* User Footer Section */}
      <div className="p-4 border-t border-white/5 relative" ref={menuRef}>
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all ${isMenuOpen ? 'bg-white/5' : ''} ${isCollapsed ? 'justify-center' : ''}`}
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-[#0f0518] shadow-lg shrink-0">
            <span className="text-white font-bold text-lg">{userInitial}</span>
          </div>
          
          {!isCollapsed && (
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.email?.split('@')[0]}</p>
              <p className="text-xs text-gray-500 truncate">Free Plan</p>
            </div>
          )}
        </button>

        {/* Popover Menu */}
        {isMenuOpen && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-[#1e1b2e] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 min-w-[200px] z-50 ml-1">
            <div className="py-1">
              <div className="px-4 py-2 border-b border-white/5">
                 <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Account</p>
              </div>
              
              <Link 
                href="/profile"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
              >
                <UserIcon className="w-4 h-4" /> Profile
              </Link>

              <Link 
                href="/dashboard"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </Link>

              <Link 
                href="/"
                className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors"
              >
                <Home className="w-4 h-4" /> Go Home
              </Link>

              <div className="border-t border-white/5 my-1"></div>
              
              <button 
                onClick={handleSignOut}
                className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};