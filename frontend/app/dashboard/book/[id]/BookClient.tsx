// "use client";
// import React, { useState, useEffect, useRef } from "react";
// import { useRouter } from "next/navigation";
// import {
//   Book as BookIcon,
//   MessageSquare,
//   Send,
//   List,
//   X,
//   ChevronLeft,
//   BookOpen,
//   Loader2,
//   User as UserIcon,
//   Bot,
// } from "lucide-react";
// // Adjust paths based on your folder structure. Assuming shared types are in src/Dashboard/types
// // import { Book } from '@/Dashboard/types';
// import { Book } from "../../types";

// import { createClient } from "../../../../lib/supabase/client";

// import { askAiTutor } from "../../../../lib/n8n";
// import { User } from "@supabase/supabase-js";

// interface BookClientProps {
//   book: Book;
//   user: User;
// }

// interface Message {
//   role: "user" | "assistant" | "error";
//   content: string;
// }

// interface Chapter {
//   id: string;
//   title: string;
//   start_page?: number;
// }

// export const BookClient: React.FC<BookClientProps> = ({ book, user }) => {
//   const router = useRouter();
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

//   // Chat State
//   const [input, setInput] = useState("");
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [isChatLoading, setIsChatLoading] = useState(false);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   // TOC State
//   const [chapters, setChapters] = useState<Chapter[]>([]);
//   const [isChaptersLoading, setIsChaptersLoading] = useState(true);

//   const supabase = createClient();

//   // Fetch Chapters (TOC)
//   useEffect(() => {
//     const fetchChapters = async () => {
//       try {
//         const { data, error } = await supabase
//           .from("chapters")
//           .select("*")
//           .eq("book_id", book.id)
//           .order("order_index", { ascending: true });

//         if (!error && data) {
//           setChapters(data);
//         }
//       } catch (error) {
//         console.error("Error fetching chapters:", error);
//       } finally {
//         setIsChaptersLoading(false);
//       }
//     };

//     fetchChapters();
//   }, [book.id, supabase]);

//   // Auto-scroll chat
//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   const handleSendMessage = async (textOverride?: string) => {
//     const messageText = textOverride || input;
//     if (!messageText.trim() || isChatLoading) return;

//     setMessages((prev) => [...prev, { role: "user", content: messageText }]);
//     setInput("");
//     setIsChatLoading(true);

//     try {
//       // Call n8n (via our Proxy Route or Direct)
//       const response = await askAiTutor(book.id, messageText, user.id);

//       // Robust Parsing to handle any JSON shape n8n sends back
//       let aiText = "I'm sorry, I couldn't understand the response.";

//       if (typeof response === "string") {
//         aiText = response;
//       } else if (Array.isArray(response) && response.length > 0) {
//         const firstItem = response[0];
//         aiText =
//           firstItem.reply ||
//           firstItem.message ||
//           firstItem.output ||
//           firstItem.text ||
//           JSON.stringify(firstItem);
//       } else if (typeof response === "object") {
//         aiText =
//           response.reply ||
//           response.message ||
//           response.output ||
//           response.text ||
//           JSON.stringify(response);
//       }

//       setMessages((prev) => [...prev, { role: "assistant", content: aiText }]);
//     } catch (error) {
//       console.error("Chat Error:", error);
//       setMessages((prev) => [
//         ...prev,
//         { role: "error", content: "AI is unreachable right now." },
//       ]);
//     } finally {
//       setIsChatLoading(false);
//     }
//   };

//   const handleKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === "Enter" && !e.shiftKey) {
//       e.preventDefault();
//       handleSendMessage();
//     }
//   };

//   return (
//     <div className="flex h-screen bg-[#13002b] text-white overflow-hidden font-sans">
//       {/* Table of Contents Sidebar Overlay */}
//       <div
//         className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#0f0518] border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
//           isSidebarOpen ? "translate-x-0" : "-translate-x-full"
//         }`}
//       >
//         <div className="p-6 flex items-center justify-between border-b border-white/10 h-16">
//           <h2 className="font-semibold text-lg text-white">
//             Table of Contents
//           </h2>
//           <button
//             onClick={() => setIsSidebarOpen(false)}
//             className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md"
//           >
//             <X className="w-5 h-5" />
//           </button>
//         </div>

//         <div className="flex-1 overflow-y-auto p-6">
//           {isChaptersLoading ? (
//             <div className="flex justify-center mt-10">
//               <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
//             </div>
//           ) : chapters.length > 0 ? (
//             <div className="space-y-2">
//               {chapters.map((chapter) => (
//                 <button
//                   key={chapter.id}
//                   className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-sm text-gray-300 hover:text-white transition-colors flex justify-between group"
//                 >
//                   <span className="truncate pr-4">{chapter.title}</span>
//                   {chapter.start_page && (
//                     <span className="text-xs text-gray-500 group-hover:text-gray-400">
//                       Pg {chapter.start_page}
//                     </span>
//                   )}
//                 </button>
//               ))}
//             </div>
//           ) : (
//             <div className="text-gray-500 text-sm text-center italic mt-10">
//               No chapters found. <br /> Is the AI still reading your book?
//             </div>
//           )}
//         </div>

//         <div className="p-6 border-t border-white/10 bg-[#0f0518]">
//           <button
//             onClick={() => router.push("/dashboard")}
//             className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors border border-white/10"
//           >
//             <ChevronLeft className="w-4 h-4" />
//             Back to Dashboard
//           </button>
//         </div>
//       </div>

//       {/* Overlay Backdrop */}
//       {isSidebarOpen && (
//         <div
//           className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
//           onClick={() => setIsSidebarOpen(false)}
//         />
//       )}

//       {/* Main Content Area */}
//       <div className="flex-1 flex flex-col min-w-0 relative">
//         <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#13002b] z-10 relative">
//           <div className="flex items-center gap-4">
//             <h1 className="text-xl font-bold truncate text-white">
//               {book.title}
//             </h1>
//           </div>
//           <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
//             <BookOpen className="w-3.5 h-3.5 text-purple-400" />
//             <span className="text-xs font-medium text-purple-200">
//               {chapters.length} Chapters
//             </span>
//           </div>
//         </header>

//         <main className="flex-1 relative bg-gradient-to-br from-[#1e0a3c] via-[#16052b] to-[#0f0518] flex items-center justify-center overflow-hidden">
//           <button
//             onClick={() => setIsSidebarOpen(true)}
//             className={`absolute top-6 left-6 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-200 z-20 ${
//               isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
//             }`}
//           >
//             <List className="w-4 h-4" />
//             Table of Contents
//           </button>

//           <div className="text-center p-8 animate-in fade-in zoom-in duration-300">
//             <div className="w-24 h-24 bg-purple-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
//               <BookIcon className="w-12 h-12 text-purple-400" />
//             </div>
//             <h3 className="text-xl font-medium text-white mb-2">
//               Select a chapter to start reading
//             </h3>
//             <p className="text-gray-400 text-sm">
//               Use the Table of Contents to navigate through the book.
//             </p>
//           </div>
//         </main>
//       </div>

//       {/* AI Tutor Sidebar */}
//       <div className="w-96 bg-[#13002b] border-l border-white/10 flex flex-col shrink-0 hidden lg:flex z-20 shadow-xl">
//         <div className="p-6 border-b border-white/10 h-16 flex flex-col justify-center">
//           <div className="flex items-center gap-2 mb-0.5">
//             <Bot className="w-4 h-4 text-purple-400" />
//             <h2 className="font-semibold text-white text-sm">AI Tutor</h2>
//           </div>
//           <p className="text-[11px] text-gray-400">
//             Ask questions about this book
//           </p>
//         </div>

//         {/* Messages */}
//         <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-[#0f0518]/50">
//           {messages.length === 0 ? (
//             <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
//               <MessageSquare className="w-8 h-8 text-purple-400 mb-2" />
//               <p className="text-xs text-gray-400 max-w-[200px] mb-4">
//                 Start a conversation!
//               </p>
//               <button
//                 onClick={() =>
//                   handleSendMessage(
//                     "Give me an overview and a study plan using my analogies."
//                   )
//                 }
//                 className="bg-purple-600 text-white px-4 py-2 rounded-full text-xs font-medium hover:bg-purple-500 transition-colors"
//               >
//                 🚀 Start Learning
//               </button>
//             </div>
//           ) : (
//             messages.map((msg, idx) => (
//               <div
//                 key={idx}
//                 className={`flex gap-3 ${
//                   msg.role === "user" ? "flex-row-reverse" : ""
//                 }`}
//               >
//                 <div
//                   className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
//                     msg.role === "user"
//                       ? "bg-purple-600"
//                       : msg.role === "error"
//                       ? "bg-red-500/20"
//                       : "bg-white/10"
//                   }`}
//                 >
//                   {msg.role === "user" ? (
//                     <UserIcon className="w-4 h-4 text-white" />
//                   ) : (
//                     <Bot className="w-4 h-4 text-purple-300" />
//                   )}
//                 </div>
//                 <div
//                   className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap ${
//                     msg.role === "user"
//                       ? "bg-purple-600 text-white rounded-tr-sm"
//                       : msg.role === "error"
//                       ? "bg-red-500/10 text-red-200 border border-red-500/20"
//                       : "bg-white/5 text-gray-200 border border-white/5 rounded-tl-sm"
//                   }`}
//                 >
//                   {msg.content}
//                 </div>
//               </div>
//             ))
//           )}
//           {isChatLoading && (
//             <div className="flex gap-3">
//               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
//                 <Bot className="w-4 h-4 text-purple-300" />
//               </div>
//               <div className="bg-white/5 rounded-2xl px-4 py-3 rounded-tl-sm flex items-center gap-1">
//                 <div
//                   className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
//                   style={{ animationDelay: "0ms" }}
//                 />
//                 <div
//                   className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
//                   style={{ animationDelay: "150ms" }}
//                 />
//                 <div
//                   className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"
//                   style={{ animationDelay: "300ms" }}
//                 />
//               </div>
//             </div>
//           )}
//           <div ref={messagesEndRef} />
//         </div>

//         {/* Suggestions */}
//         {messages.length > 0 &&
//           messages[messages.length - 1].role === "assistant" && (
//             <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
//               <button
//                 onClick={() =>
//                   handleSendMessage("Explain the next part using an analogy")
//                 }
//                 className="whitespace-nowrap px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-[10px] rounded-full border border-purple-500/20 transition-colors"
//               >
//                 👉 Teach next concept
//               </button>
//               <button
//                 onClick={() => handleSendMessage("Give me a quiz on this")}
//                 className="whitespace-nowrap px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] rounded-full border border-cyan-500/20 transition-colors"
//               >
//                 📝 Quiz me
//               </button>
//             </div>
//           )}

//         {/* Input */}
//         <div className="p-4 border-t border-white/10 bg-[#0f0518]">
//           <div className="relative group">
//             <input
//               type="text"
//               value={input}
//               onChange={(e) => setInput(e.target.value)}
//               onKeyDown={handleKeyDown}
//               placeholder="Ask about this book..."
//               className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
//               disabled={isChatLoading}
//             />
//             <button
//               onClick={() => handleSendMessage()}
//               disabled={!input.trim() || isChatLoading}
//               className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
//             >
//               <Send className="w-4 h-4" />
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };

// "use client"
// import React, { useState, useEffect, useRef } from "react";
// import { useRouter } from "next/navigation";
// import {
//   Book as BookIcon,
//   MessageSquare,
//   Send,
//   List,
//   X,
//   ChevronLeft,
//   BookOpen,
//   Loader2,
//   User as UserIcon,
//   Bot,
// } from "lucide-react";

// import { Book } from "../../types";
// import { createClient } from "../../../../lib/supabase/client";
// import { askAiTutor } from "../../../../lib/n8n";
// import { User } from "@supabase/supabase-js";

// interface BookClientProps {
//   book: Book;
//   user: User;
// }

// interface Message {
//   role: "user" | "assistant" | "error";
//   content: string;
// }

// interface Chapter {
//   id: string;
//   title: string;
//   start_page?: number;
// }

// export const BookClient: React.FC<BookClientProps> = ({ book, user }) => {
//   const router = useRouter();
//   const supabase = createClient();
//   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

//   // Chat State
//   const [input, setInput] = useState("");
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [isChatLoading, setIsChatLoading] = useState(false);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   // TOC State
//   const [chapters, setChapters] = useState<Chapter[]>([]);
//   const [isChaptersLoading, setIsChaptersLoading] = useState(true);

//   // 1. LOAD CHAT HISTORY ON MOUNT
//   useEffect(() => {
//     const loadHistory = async () => {
//       const { data } = await supabase
//         .from("lessons")
//         .select("user_query, ai_response, created_at")
//         .eq("book_id", book.id)
//         .eq("user_id", user.id)
//         .order("created_at", { ascending: true });

//       if (data) {
//         const history: Message[] = [];
//         data.forEach((lesson) => {
//           if (lesson.user_query)
//             history.push({ role: "user", content: lesson.user_query });
//           if (lesson.ai_response)
//             history.push({ role: "assistant", content: lesson.ai_response });
//         });
//         setMessages(history);
//       }
//     };

//     const fetchChapters = async () => {
//       const { data } = await supabase
//         .from("chapters")
//         .select("*")
//         .eq("book_id", book.id)
//         .order("order_index", { ascending: true });

//       if (data) setChapters(data);
//       setIsChaptersLoading(false);
//     };

//     loadHistory();
//     fetchChapters();
//   }, [book.id, user.id, supabase]);

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   const handleSendMessage = async (textOverride?: string) => {
//     const messageText = textOverride || input;
//     if (!messageText.trim() || isChatLoading) return;

//     setMessages((prev) => [...prev, { role: "user", content: messageText }]);
//     setInput("");
//     setIsChatLoading(true);

//     try {
//       const response = await askAiTutor(book.id, messageText, user.id);

//       // Robust Parsing
//       let aiText = "";
//       if (typeof response === "string") aiText = response;
//       else if (response?.reply) aiText = response.reply;
//       else if (response?.message) aiText = response.message;
//       else aiText = JSON.stringify(response);

//       setMessages((prev) => [...prev, { role: "assistant", content: aiText }]);
//     } catch (error) {
//       setMessages((prev) => [
//         ...prev,
//         { role: "error", content: "AI is unreachable." },
//       ]);
//     } finally {
//       setIsChatLoading(false);
//     }
//   };

//   // ... (Rest of the UI: Render logic for Sidebar, Chat, Input) ...
//   // Note: I am abbreviating the render logic to keep this response focused.
//   // Use the exact return statement from the previous BookClient.tsx I gave you.

//   return (
//     <div className="flex h-screen bg-[#13002b] text-white overflow-hidden font-sans">
//       {/* Reuse the exact JSX from the previous valid BookClient.tsx */}
//       {/* ... Sidebar, Header, Main Content, Chat Panel ... */}
//       {/* Ensure you keep the messages map and input logic */}

//       <div
//         className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#0f0518] border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
//           isSidebarOpen ? "translate-x-0" : "-translate-x-full"
//         }`}
//       >
//         <div className="p-6 flex items-center justify-between border-b border-white/10 h-16">
//           <h2 className="font-semibold text-lg text-white">
//             Table of Contents
//           </h2>
//           <button
//             onClick={() => setIsSidebarOpen(false)}
//             className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md"
//           >
//             <X className="w-5 h-5" />
//           </button>
//         </div>

//         <div className="flex-1 overflow-y-auto p-6">
//           {isChaptersLoading ? (
//             <div className="flex justify-center mt-10">
//               <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
//             </div>
//           ) : chapters.length > 0 ? (
//             <div className="space-y-2">
//               {chapters.map((chapter) => (
//                 <button
//                   key={chapter.id}
//                   className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-sm text-gray-300 hover:text-white transition-colors flex justify-between group"
//                 >
//                   <span className="truncate pr-4">{chapter.title}</span>
//                   {chapter.start_page && (
//                     <span className="text-xs text-gray-500 group-hover:text-gray-400">
//                       Pg {chapter.start_page}
//                     </span>
//                   )}
//                 </button>
//               ))}
//             </div>
//           ) : (
//             <div className="text-gray-500 text-sm text-center italic mt-10">
//               No chapters found. <br /> Is the AI still reading your book?
//             </div>
//           )}
//         </div>

//         <div className="p-6 border-t border-white/10 bg-[#0f0518]">
//           <button
//             onClick={() => router.push("/dashboard")}
//             className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors border border-white/10"
//           >
//             <ChevronLeft className="w-4 h-4" />
//             Back to Dashboard
//           </button>
//         </div>
//       </div>

//       {/* Overlay Backdrop */}
//       {isSidebarOpen && (
//         <div
//           className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
//           onClick={() => setIsSidebarOpen(false)}
//         />
//       )}

//       {/* Main Content Area */}
//       <div className="flex-1 flex flex-col min-w-0 relative">
//         <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#13002b] z-10 relative">
//           <div className="flex items-center gap-4">
//             <h1 className="text-xl font-bold truncate text-white">
//               {book.title}
//             </h1>
//           </div>
//           <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
//             <BookOpen className="w-3.5 h-3.5 text-purple-400" />
//             <span className="text-xs font-medium text-purple-200">
//               {chapters.length} Chapters
//             </span>
//           </div>
//         </header>

//         <main className="flex-1 relative bg-gradient-to-br from-[#1e0a3c] via-[#16052b] to-[#0f0518] flex items-center justify-center overflow-hidden">
//           <button
//             onClick={() => setIsSidebarOpen(true)}
//             className={`absolute top-6 left-6 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-200 z-20 ${
//               isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
//             }`}
//           >
//             <List className="w-4 h-4" />
//             Table of Contents
//           </button>

//           <div className="text-center p-8 animate-in fade-in zoom-in duration-300">
//             <div className="w-24 h-24 bg-purple-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
//               <BookIcon className="w-12 h-12 text-purple-400" />
//             </div>
//             <h3 className="text-xl font-medium text-white mb-2">
//               Select a chapter to start reading
//             </h3>
//             <p className="text-gray-400 text-sm">
//               Use the Table of Contents to navigate through the book.
//             </p>
//           </div>
//         </main>
//       </div>

//       {/* the chat panel */}
//       <div className="w-96 bg-[#13002b] border-l border-white/10 flex flex-col shrink-0 hidden lg:flex z-20 shadow-xl">
//         <div className="p-6 border-b border-white/10 h-16 flex flex-col justify-center">
//           <div className="flex items-center gap-2 mb-0.5">
//             <Bot className="w-4 h-4 text-purple-400" />
//             <h2 className="font-semibold text-white text-sm">AI Tutor</h2>
//           </div>
//           <p className="text-[11px] text-gray-400">
//             Ask questions about this book
//           </p>
//         </div>

//         <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-[#0f0518]/50">
//           {messages.length === 0 ? (
//             <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
//               <MessageSquare className="w-8 h-8 text-purple-400 mb-2" />
//               <p className="text-xs text-gray-400 max-w-[200px] mb-4">
//                 Start a conversation!
//               </p>
//               <button
//                 onClick={() => handleSendMessage("Teach me the first concept")}
//                 className="bg-purple-600 text-white px-4 py-2 rounded-full text-xs font-medium hover:bg-purple-500 transition-colors"
//               >
//                 🚀 Start Learning
//               </button>
//             </div>
//           ) : (
//             messages.map((msg, idx) => (
//               <div
//                 key={idx}
//                 className={`flex gap-3 ${
//                   msg.role === "user" ? "flex-row-reverse" : ""
//                 }`}
//               >
//                 <div
//                   className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
//                     msg.role === "user" ? "bg-purple-600" : "bg-white/10"
//                   }`}
//                 >
//                   {msg.role === "user" ? (
//                     <UserIcon className="w-4 h-4 text-white" />
//                   ) : (
//                     <Bot className="w-4 h-4 text-purple-300" />
//                   )}
//                 </div>
//                 <div
//                   className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap ${
//                     msg.role === "user"
//                       ? "bg-purple-600 text-white rounded-tr-sm"
//                       : "bg-white/5 text-gray-200 border border-white/5 rounded-tl-sm"
//                   }`}
//                 >
//                   {msg.content}
//                 </div>
//               </div>
//             ))
//           )}
//           {isChatLoading && (
//             <div className="flex gap-3">
//               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
//                 <Bot className="w-4 h-4 text-purple-300" />
//               </div>
//               <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center gap-1">
//                 <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
//               </div>
//             </div>
//           )}
//           <div ref={messagesEndRef} />
//         </div>

//         <div className="p-4 border-t border-white/10 bg-[#0f0518]">
//           <div className="relative group">
//             <input
//               type="text"
//               value={input}
//               onChange={(e) => setInput(e.target.value)}
//               onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
//               placeholder="Ask about this book..."
//               className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
//               disabled={isChatLoading}
//             />
//             <button
//               onClick={() => handleSendMessage()}
//               className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500"
//             >
//               <Send className="w-4 h-4" />
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// };



"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Book as BookIcon,
  MessageSquare,
  Send,
  List,
  X,
  ChevronLeft,
  BookOpen,
  Loader2,
  User as UserIcon,
  Bot,
  Play,
  CheckCircle2,
  Target,
  Clock,
  ArrowRight,
} from "lucide-react";

import { Book } from "../../types";
import { createClient } from "../../../../lib/supabase/client";
import { askAiTutor } from "../../../../lib/n8n";
import { User } from "@supabase/supabase-js";

interface BookClientProps {
  book: Book;
  user: User;
}

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
}

interface Chapter {
  id: string;
  title: string;
  start_page?: number;
}

interface BookStatus {
  last_studied: string;
  next_paragraph: string;
  current_index: number;
}

// Helper for Session Tracking
interface SessionStats {
  isActive: boolean;
  goal: number;
  current: number;
}

export const BookClient: React.FC<BookClientProps> = ({ book, user }) => {
  const router = useRouter();
  const supabase = createClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Chat State
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TOC State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isChaptersLoading, setIsChaptersLoading] = useState(true);

  // Status/Welcome State (New)
  const [bookStatus, setBookStatus] = useState<BookStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  // Session State (New)
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    isActive: false,
    goal: 1,
    current: 0,
  });

  // --- 1. LOAD DATA ON MOUNT ---
  useEffect(() => {
    // A. Load Chat History
    const loadHistory = async () => {
      // NOTE: Ensure your 'lessons' table has these columns and permissions are open for the user
      const { data, error } = await supabase
        .from("lessons")
        .select("user_query, ai_response, created_at")
        .eq("book_id", book.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }); // Important: Chronological order

      if (data) {
        const history: Message[] = [];
        data.forEach((lesson) => {
          if (lesson.user_query)
            history.push({ role: "user", content: lesson.user_query });
          if (lesson.ai_response)
            history.push({ role: "assistant", content: lesson.ai_response });
        });
        setMessages(history);
      }
    };

    // B. Load Chapters
    const fetchChapters = async () => {
      const { data } = await supabase
        .from("chapters")
        .select("*")
        .eq("book_id", book.id)
        .order("order_index", { ascending: true });

      if (data) setChapters(data);
      setIsChaptersLoading(false);
    };

    // C. Load Book Status (The Welcome Logic)
    // const fetchBookStatus = async () => {
    //   try {
    //     // CALLING YOUR N8N WORKFLOW #2 (GET /book-status)
    //     // Replace with your actual N8N webhook URL for the GET method
    //     const WEBHOOK_URL = `http://localhost:5678/webhook/ai-tutor`;
        
    //     // Note: Since this is a Client Component, ensure your N8N CORS settings allow this, 
    //     // or proxy this through your Next.js API routes if you get CORS errors.
    //     const res = await fetch(WEBHOOK_URL);
    //     const data = await res.json();
        
    //     if (data && data.last_studied) {
    //       setBookStatus(data);
    //     }
    //   } catch (e) {
    //     console.error("Failed to load status", e);
    //   } finally {
    //     setIsStatusLoading(false);
    //   }
    // };
    // C. Load Book Status (Updated with Fallback)
    const fetchBookStatus = async () => {
      try {
        // REPLACE THIS URL WITH YOUR ACTUAL N8N WORKFLOW #2 URL
        const WEBHOOK_URL = `http://localhost:5678/webhook/ai-tutor`;
        
        const res = await fetch(WEBHOOK_URL);
        
        if (!res.ok) throw new Error("API Failed");
        
        const data = await res.json();
        setBookStatus(data);
      } catch (e) {
        console.warn("N8N Fetch failed, using MOCK DATA for UI testing");
        // FALLBACK MOCK DATA SO YOU CAN SEE THE UI
        setBookStatus({
          last_studied: "You haven't started yet.",
          next_paragraph: "The starting point of all achievement is DESIRE. Keep this constantly in mind. Weak desire brings weak results, just as a small amount of fire makes a small amount of heat.",
          current_index: 1
        });
      } finally {
        setIsStatusLoading(false);
      }
    };

    loadHistory();
    fetchChapters();
    fetchBookStatus();
  }, [book.id, user.id, supabase]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- 2. START SESSION LOGIC ---
  const handleStartSession = (paragraphCount: number) => {
    setSessionStats({
      isActive: true,
      goal: paragraphCount,
      current: 0,
    });
    
    // Trigger the first paragraph
    handleSendMessage("Sure, let's start!", true);
  };

  // --- 3. SEND MESSAGE LOGIC ---
  const handleSendMessage = async (textOverride?: string, isSystemTrigger?: boolean) => {
    const messageText = textOverride || input;
    if (!messageText.trim() || isChatLoading) return;

    // Optimistic Update
    setMessages((prev) => [...prev, { role: "user", content: messageText }]);
    if (!isSystemTrigger) setInput(""); // Only clear input if user typed it
    setIsChatLoading(true);

    try {
      // Call N8N Workflow #3 (POST /ai-tutor)
      const response = await askAiTutor(book.id, messageText, user.id);

      // Robust Parsing
      let aiText = "";
      if (typeof response === "string") aiText = response;
      else if (response?.reply) aiText = response.reply;
      else if (response?.message) aiText = response.message;
      else aiText = JSON.stringify(response);

      setMessages((prev) => [...prev, { role: "assistant", content: aiText }]);
      
      // -- UPDATE SESSION PROGRESS --
      if (sessionStats.isActive) {
        setSessionStats(prev => ({
          ...prev,
          current: prev.current + 1
        }));
        
        // If we still have paragraphs to go, refresh the status for the next prompt
        // (Optional: You could also just optimistically fetch next chunk)
      }

    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: "AI is unreachable right now." },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#13002b] text-white overflow-hidden font-sans">
      
      {/* --- SIDEBAR (Table of Contents) --- */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#0f0518] border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/10 h-16">
          <h2 className="font-semibold text-lg text-white">Table of Contents</h2>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isChaptersLoading ? (
            <div className="flex justify-center mt-10">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : chapters.length > 0 ? (
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  className="w-full text-left p-3 rounded-lg hover:bg-white/5 text-sm text-gray-300 hover:text-white transition-colors flex justify-between group"
                >
                  <span className="truncate pr-4">{chapter.title}</span>
                  {chapter.start_page && (
                    <span className="text-xs text-gray-500 group-hover:text-gray-400">
                      Pg {chapter.start_page}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm text-center italic mt-10">
              No chapters found.
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-[#0f0518]">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 py-3 px-4 rounded-lg text-sm font-medium transition-colors border border-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* --- MAIN CONTENT AREA (The Welcome Dashboard) --- */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#13002b] z-10 relative">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold truncate text-white">
              {book.title}
            </h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden flex items-center gap-2 text-sm text-gray-400"
          >
            <List className="w-4 h-4" />
            Chapters
          </button>
        </header>

        <main className="flex-1 relative bg-gradient-to-br from-[#1e0a3c] via-[#16052b] to-[#0f0518] flex flex-col items-center justify-center p-8 overflow-y-auto">
          {/* BACKGROUND DECORATION */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-6 left-6 hidden lg:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-200 z-20"
          >
            <List className="w-4 h-4" />
            Table of Contents
          </button>

          {isStatusLoading ? (
             <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
          ) : bookStatus ? (
            <div className="max-w-2xl w-full space-y-8 animate-in fade-in zoom-in duration-300">
              
              {/* WELCOME HEADER */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-2">Welcome back, Scholar!</h2>
                <p className="text-gray-400">You are currently at Chunk #{bookStatus.current_index}. Ready to make progress?</p>
              </div>

              {/* STATUS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Last Studied */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CheckCircle2 className="w-16 h-16 text-green-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Completed
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                    "{bookStatus.last_studied}"
                  </p>
                </div>

                {/* Up Next */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6 relative overflow-hidden group shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                   <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Target className="w-16 h-16 text-purple-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" /> Up Next
                  </h3>
                  <p className="text-white text-sm leading-relaxed line-clamp-4 font-medium">
                    "{bookStatus.next_paragraph}"
                  </p>
                </div>
              </div>

              {/* ACTION AREA - COMMIT TO STUDY */}
              <div className="bg-[#0f0518] border border-white/10 rounded-2xl p-6 flex flex-col items-center">
                <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  How much energy do you have today?
                </h3>
                
                <div className="flex flex-wrap gap-3 justify-center mb-6">
                  {[1, 2, 3, 5].map((num) => (
                    <button
                      key={num}
                      onClick={() => setSessionStats(prev => ({...prev, goal: num}))}
                      className={`px-6 py-3 rounded-lg border text-sm font-medium transition-all ${
                        sessionStats.goal === num 
                        ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/25" 
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {num} Paragraph{num > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handleStartSession(sessionStats.goal)}
                  className="w-full max-w-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-purple-900/20 flex items-center justify-center gap-2 transition-transform active:scale-95"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Studying ({sessionStats.goal} chunks)
                </button>
              </div>

            </div>
          ) : (
            // Fallback if status fails or empty
            <div className="text-center">
              <BookIcon className="w-12 h-12 text-purple-500/50 mx-auto mb-4" />
              <h3 className="text-white text-lg">Select a chapter from the left to begin</h3>
            </div>
          )}
        </main>
      </div>

      {/* --- RIGHT PANEL: CHAT INTERFACE --- */}
      <div className="w-96 bg-[#13002b] border-l border-white/10 flex flex-col shrink-0 hidden lg:flex z-20 shadow-xl relative">
        
        {/* Chat Header */}
        <div className="p-6 border-b border-white/10 h-16 flex flex-col justify-center bg-[#13002b]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              <h2 className="font-semibold text-white text-sm">AI Tutor</h2>
            </div>
            
            {/* Session Progress Indicator */}
            {sessionStats.isActive && (
              <div className="flex items-center gap-2 bg-purple-500/20 px-2 py-1 rounded text-xs text-purple-200 border border-purple-500/30">
                <Target className="w-3 h-3" />
                <span>{sessionStats.current} / {sessionStats.goal} Completed</span>
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-[#0f0518]/50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
              <MessageSquare className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-xs text-gray-400 max-w-[200px]">
                Your conversation history will appear here.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user" ? "bg-purple-600" : "bg-white/10"
                  }`}
                >
                  {msg.role === "user" ? (
                    <UserIcon className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-purple-300" />
                  )}
                </div>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-tr-sm"
                      : "bg-white/5 text-gray-200 border border-white/5 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}

          {/* Prompt to continue session */}
          {sessionStats.isActive && !isChatLoading && sessionStats.current < sessionStats.goal && sessionStats.current > 0 && (
             <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2">
                <button 
                  onClick={() => handleSendMessage("Yes, continue to the next paragraph.", true)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-purple-900/50 transition-all"
                >
                  Continue to Next Paragraph <ArrowRight className="w-3 h-3" />
                </button>
             </div>
          )}

          {isChatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-300" />
              </div>
              <div className="bg-white/5 rounded-2xl px-4 py-3 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-75" />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-[#0f0518]">
          <div className="relative group">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={sessionStats.isActive ? "Ask a question or type 'Next'..." : "Ask about this book..."}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
              disabled={isChatLoading}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isChatLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};