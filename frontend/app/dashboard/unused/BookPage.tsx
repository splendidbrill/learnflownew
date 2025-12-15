  // "use client";
  // import React, { useState } from 'react';
  // import { Book as BookIcon, MessageSquare, Send, List, X, ChevronLeft, BookOpen } from 'lucide-react';
  // import { Book } from '../types';

  // interface BookPageProps {
  //   book: Book;
  //   onBack: () => void;
  // }

  // export const BookPage: React.FC<BookPageProps> = ({ book, onBack }) => {
  //   const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  //   return (
  //     <div className="flex h-screen bg-[#13002b] text-white overflow-hidden font-sans">
  //       {/* Table of Contents Sidebar Overlay */}
  //       <div 
  //         className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#0f0518] border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
  //           isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
  //         }`}
  //       >
  //         <div className="p-6 flex items-center justify-between border-b border-white/10 h-16">
  //           <h2 className="font-semibold text-lg text-white">Table of Contents</h2>
  //           <button 
  //             onClick={() => setIsSidebarOpen(false)} 
  //             className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md"
  //           >
  //             <X className="w-5 h-5" />
  //           </button>
  //         </div>
          
  //         <div className="flex-1 overflow-y-auto p-6">
  //           <div className="text-gray-500 text-sm text-center italic mt-10">
  //             No chapters available yet.
  //           </div>
  //         </div>

  //         <div className="p-6 border-t border-white/10 bg-[#0f0518]">
  //           <button 
  //             onClick={onBack}
  //             className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors border border-white/10"
  //           >
  //             <ChevronLeft className="w-4 h-4" />
  //             Back to Dashboard
  //           </button>
  //         </div>
  //       </div>

  //       {/* Overlay Backdrop for Mobile/Tablet when sidebar is open */}
  //       {isSidebarOpen && (
  //         <div 
  //           className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
  //           onClick={() => setIsSidebarOpen(false)}
  //         />
  //       )}

  //       {/* Main Content Area */}
  //       <div className="flex-1 flex flex-col min-w-0 relative">
  //         {/* Header */}
  //         <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#13002b] z-10 relative">
  //           <div className="flex items-center gap-4">
  //             <h1 className="text-xl font-bold truncate text-white">{book.title}</h1>
  //           </div>
  //           <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
  //             <BookOpen className="w-3.5 h-3.5 text-purple-400" />
  //             <span className="text-xs font-medium text-purple-200">0 Chapters</span>
  //           </div>
  //         </header>

  //         {/* Main Body */}
  //         <main className="flex-1 relative bg-gradient-to-br from-[#1e0a3c] via-[#16052b] to-[#0f0518] flex items-center justify-center overflow-hidden">
  //           {/* Table of Contents Toggle Button */}
  //           <button 
  //             onClick={() => setIsSidebarOpen(true)}
  //             className={`absolute top-6 left-6 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-200 z-20 ${
  //               isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
  //             }`}
  //           >
  //             <List className="w-4 h-4" />
  //             Table of Contents
  //           </button>

  //           {/* Empty State / Content Placeholder */}
  //           <div className="text-center p-8 animate-in fade-in zoom-in duration-300">
  //             <div className="w-24 h-24 bg-purple-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
  //               <BookIcon className="w-12 h-12 text-purple-400" />
  //             </div>
  //             <h3 className="text-xl font-medium text-white mb-2">Select a chapter to start reading</h3>
  //             <p className="text-gray-400 text-sm">Use the Table of Contents to navigate through the book.</p>
  //           </div>
  //         </main>
  //       </div>

  //       {/* AI Tutor Sidebar (Right Panel) */}
  //       <div className="w-96 bg-[#13002b] border-l border-white/10 flex flex-col shrink-0 hidden lg:flex z-20 shadow-xl">
  //         <div className="p-6 border-b border-white/10 h-16 flex flex-col justify-center">
  //           <div className="flex items-center gap-2 mb-0.5">
  //             <MessageSquare className="w-4 h-4 text-purple-400" />
  //             <h2 className="font-semibold text-white text-sm">AI Tutor</h2>
  //           </div>
  //           <p className="text-[11px] text-gray-400">Ask questions about this chapter</p>
  //         </div>

  //         <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
  //           <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 rounded-bl-none border border-white/5">
  //             <MessageSquare className="w-7 h-7 text-purple-400/60" />
  //           </div>
  //           <h3 className="text-white font-medium mb-2">Start a conversation with your AI tutor</h3>
  //           <p className="text-xs text-gray-500 leading-relaxed max-w-[200px]">
  //             Try asking: "Explain the main concepts in this chapter"
  //           </p>
  //         </div>

  //         <div className="p-4 border-t border-white/10 bg-[#0f0518]">
  //           <div className="relative group">
  //             <input 
  //               type="text" 
  //               placeholder="Ask about this chapter..."
  //               className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
  //             />
  //             <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20 group-focus-within:scale-105 transform duration-200">
  //               <Send className="w-4 h-4" />
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Book as BookIcon, MessageSquare, Send, List, X, ChevronLeft, BookOpen, Loader2, User as UserIcon, Bot } from 'lucide-react';
import { Book } from '../types';
import { createClient } from '../../../lib/supabase/client';
import { askAiTutor } from '../../../lib/n8n';
import { User } from '@supabase/supabase-js';

interface BookPageProps {
  book: Book;
  user: User; // <--- ADDED USER PROP
  onBack: () => void;
}

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface Chapter {
  id: string;
  title: string;
  start_page?: number;
}

export const BookPage: React.FC<BookPageProps> = ({ book, user, onBack }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Chat State
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // TOC State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [isChaptersLoading, setIsChaptersLoading] = useState(true);

  const supabase = createClient();

  // Fetch Chapters (TOC)
  useEffect(() => {
    const fetchChapters = async () => {
      try {
        const { data, error } = await supabase
          .from('chapters')
          .select('*')
          .eq('book_id', book.id)
          .order('order_index', { ascending: true });
        
        if (!error && data) {
          setChapters(data);
        }
      } catch (error) {
        console.error("Error fetching chapters:", error);
      } finally {
        setIsChaptersLoading(false);
      }
    };

    fetchChapters();
  }, [book.id, supabase]);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isChatLoading) return;
    
    const userMessage = input;
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput("");
    setIsChatLoading(true);

    try {
      const response = await askAiTutor(book.id, userMessage, user.id);
      setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'error', content: "AI is unreachable right now." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-[#13002b] text-white overflow-hidden font-sans">
      {/* Table of Contents Sidebar Overlay */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-[#0f0518] border-r border-white/10 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/10 h-16">
          <h2 className="font-semibold text-lg text-white">Table of Contents</h2>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-md"
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
                  {chapter.start_page && <span className="text-xs text-gray-500 group-hover:text-gray-400">Pg {chapter.start_page}</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm text-center italic mt-10">
              No chapters found. <br/> Is the AI still reading your book?
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/10 bg-[#0f0518]">
          <button 
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-gray-200 hover:text-white py-3 px-4 rounded-lg text-sm font-medium transition-colors border border-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Overlay Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-[#13002b] z-10 relative">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold truncate text-white">{book.title}</h1>
          </div>
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-medium text-purple-200">{chapters.length} Chapters</span>
          </div>
        </header>

        {/* Main Body (Placeholder for now) */}
        <main className="flex-1 relative bg-gradient-to-br from-[#1e0a3c] via-[#16052b] to-[#0f0518] flex items-center justify-center overflow-hidden">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className={`absolute top-6 left-6 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-all text-gray-200 z-20 ${
              isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <List className="w-4 h-4" />
            Table of Contents
          </button>

          <div className="text-center p-8 animate-in fade-in zoom-in duration-300">
            <div className="w-24 h-24 bg-purple-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3 border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.1)]">
              <BookIcon className="w-12 h-12 text-purple-400" />
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Select a chapter to start reading</h3>
            <p className="text-gray-400 text-sm">Use the Table of Contents to navigate through the book.</p>
          </div>
        </main>
      </div>

      {/* AI Tutor Sidebar (Right Panel - Chat) */}
      <div className="w-96 bg-[#13002b] border-l border-white/10 flex flex-col shrink-0 hidden lg:flex z-20 shadow-xl">
        <div className="p-6 border-b border-white/10 h-16 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-0.5">
            <Bot className="w-4 h-4 text-purple-400" />
            <h2 className="font-semibold text-white text-sm">AI Tutor</h2>
          </div>
          <p className="text-[11px] text-gray-400">Ask questions about this book</p>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4 bg-[#0f0518]/50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
              <MessageSquare className="w-8 h-8 text-purple-400 mb-2" />
              <p className="text-xs text-gray-400 max-w-[200px]">
                Start a conversation! Try asking: <br/> "Explain the main concepts in this book"
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-purple-600' : msg.role === 'error' ? 'bg-red-500/20' : 'bg-white/10'
                }`}>
                  {msg.role === 'user' ? <UserIcon className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-purple-300" />}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 text-sm max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-purple-600 text-white rounded-tr-sm' 
                    : msg.role === 'error'
                    ? 'bg-red-500/10 text-red-200 border border-red-500/20'
                    : 'bg-white/5 text-gray-200 border border-white/5 rounded-tl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {isChatLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-purple-300" />
              </div>
              <div className="bg-white/5 rounded-2xl px-4 py-3 rounded-tl-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Area */}
        <div className="p-4 border-t border-white/10 bg-[#0f0518]">
          <div className="relative group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this book..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 focus:bg-white/10 transition-all"
              disabled={isChatLoading}
            />
            <button 
              onClick={handleSendMessage}
              disabled={!input.trim() || isChatLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};