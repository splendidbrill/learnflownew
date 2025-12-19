"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Menu, X, Send, MessageSquare, BookOpen, 
  CheckCircle, LogOut, Loader2, FileText, ChevronRight, AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// --- 1. TYPES ---
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface BookClientProps {
  bookId: string;
}

interface Chapter {
  id: string;
  title: string;
  order_index: number;
  start_page_num: number;
  progress?: number;
}

interface Paragraph {
  id: string;
  content: string;
  is_completed: boolean;
}

interface Book {
  id: string;
  title: string;
  file_url: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export const BookClient: React.FC<BookClientProps> = ({ bookId }) => {
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- 2. STATE ---
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [bookStatus, setBookStatus] = useState<string>("pending");
  const [isGenerating, setIsGenerating] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // --- 3. DATA FETCHING ---
  
  const fetchBookData = async () => {
    if (!bookId) return;

    // A. Fetch Book
    const { data: bookData } = await supabase
      .from('course_books') // Ensure this matches your table name
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookData) {
      setBook(bookData);
      setBookStatus(bookData.status || 'pending');
    }

    // B. Fetch Chapters
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .order('order_index', { ascending: true });

    if (chapterData) {
      setChapters(chapterData);
    }
    
    setIsLoadingData(false);
  };

  useEffect(() => {
    fetchBookData();
  }, [bookId]);

  // Polling Effect for Book Status
  useEffect(() => {
    const interval = setInterval(() => {
      if (bookStatus === "processing") {
        fetchBookData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [bookStatus, bookId]);

  // Load Paragraphs when Chapter Selected
  useEffect(() => {
    const loadParagraphs = async () => {
      if (!selectedChapter) return;
      const { data } = await supabase
        .from('paragraphs')
        .select('*')
        .eq('chapter_id', selectedChapter.id)
        .order('order_index', { ascending: true });
      setParagraphs(data || []);
    };
    loadParagraphs();
  }, [selectedChapter]);


  // --- 4. HANDLERS (LOGIC) ---

  const handleGenerateMap = async () => {
    if (!book?.file_url) return alert("Error: Book URL missing");
    setIsGenerating(true);
    setBookStatus("processing");

    try {
      const response = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: bookId,
          fileUrl: book.file_url,
          interest: "General Learning",
          bookType: "Textbook"
        }),
      });
      if (!response.ok) throw new Error("Backend failed");
    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      setBookStatus("failed");
      alert("Failed to connect to AI Backend: " + e.message);
    }
  };

  // NEW HANDLER: Generate Content for a Single Chapter
  const handleGenerateChapterContent = async () => {
    if (!selectedChapter) return;
    
    setIsGenerating(true); 
    
    try {
      const res = await fetch("http://localhost:8000/generate_chapter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: selectedChapter.id }),
      });
      
      if (!res.ok) throw new Error("Failed to start generation");
      
      // Poll specifically for paragraphs now
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from('paragraphs')
          .select('*')
          .eq('chapter_id', selectedChapter.id)
          .order('order_index', { ascending: true });
          
        if (data && data.length > 0) {
           setParagraphs(data);
           setIsGenerating(false); // Stop loading spinner once we see data
           clearInterval(interval);
        }
      }, 3000);

    } catch (e: any) {
      alert("Error: " + e.message);
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChapter) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsAiThinking(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chapterId: selectedChapter.id
        }),
      });

      if (!response.ok) throw new Error(response.statusText);
      if (!response.body) return;

      const aiMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: aiMessageId, role: 'assistant', content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        accumulatedText += chunkValue;

        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg
        ));
      }
    } catch (error: any) {
      alert("Chat Error: " + error.message);
    } finally {
      setIsAiThinking(false);
    }
  };

  // --- 5. RENDER HELPERS ---

  const renderDashboard = () => (
    <div className="h-full w-full overflow-y-auto p-10 animate-in fade-in duration-500 scrollbar-thin scrollbar-thumb-purple-900/50">
      <div className="max-w-5xl mx-auto pb-20">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-400 shadow-lg shadow-purple-900/20">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">{book?.title || 'Loading Book...'}</h1>
          <div className="flex justify-center mt-4">
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wider border uppercase ${
              bookStatus === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
              bookStatus === 'processing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse' :
              bookStatus === 'failed' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
              'bg-gray-800 text-gray-400 border-gray-700'
            }`}>
              {bookStatus}
            </span>
          </div>
        </div>

        {bookStatus === "processing" && (
          <div className="text-center py-20 border-2 border-dashed border-blue-500/30 rounded-3xl bg-blue-500/5 animate-pulse">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
               <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Analyzing Book Structure...</h2>
            <p className="text-blue-200/60 text-lg">Our AI is reading the Table of Contents.</p>
          </div>
        )}

        {bookStatus === "pending" && (
          <div className="text-center py-24 border-2 border-dashed border-white/10 rounded-3xl bg-white/5">
            <div className="w-20 h-20 bg-gray-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/10">
               <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Organize</h2>
            <p className="text-gray-400 mb-10 max-w-lg mx-auto text-lg">
              Click below to generate a clickable course map.
            </p>
            <button 
              onClick={handleGenerateMap}
              disabled={isGenerating}
              className="group relative inline-flex items-center justify-center px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-purple-500/30 hover:-translate-y-1 disabled:opacity-50"
            >
              {isGenerating ? (
                <><Loader2 className="w-6 h-6 animate-spin mr-3" /> Starting AI Engine...</>
              ) : (
                <>✨ Generate Course Map <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1" /></>
              )}
            </button>
          </div>
        )}

        {bookStatus === "failed" && (
          <div className="text-center py-12 bg-red-900/10 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white">Scan Failed</h3>
            <button onClick={() => setBookStatus('pending')} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-medium transition-colors mt-4">
              Reset & Try Again
            </button>
          </div>
        )}

        {(bookStatus === "completed" || chapters.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => setSelectedChapter(chapter)}
                className="group text-left bg-[#1e0a3c] hover:bg-[#2a1352] border border-white/5 hover:border-purple-500/50 p-6 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-900/20 relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 px-2 py-1 rounded">CH {chapter.order_index}</span>
                  {chapter.start_page_num > 0 && (
                    <span className="text-[10px] text-gray-500 font-mono bg-white/5 px-2 py-1 rounded">Pg {chapter.start_page_num}</span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2 leading-snug group-hover:text-purple-200">{chapter.title}</h3>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderReader = () => (
    <div className="flex flex-col h-full bg-[#0f0518] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/50">
      <div className="sticky top-0 bg-[#0f0518]/95 backdrop-blur z-10 border-b border-white/5 p-4 flex items-center gap-4">
         <button onClick={() => setSelectedChapter(null)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white">
           <ArrowLeft className="w-5 h-5" />
         </button>
         <div>
           <h2 className="text-white font-semibold">{selectedChapter?.title}</h2>
           <p className="text-xs text-gray-400">
             {selectedChapter?.start_page_num ? `Starts at Page ${selectedChapter.start_page_num}` : 'Reading Mode'}
           </p>
         </div>
      </div>

      <div className="max-w-3xl mx-auto w-full p-8 space-y-8 pb-20">
        {paragraphs.length > 0 ? (
          paragraphs.map((para) => (
            <div key={para.id} className="group relative p-6 rounded-2xl border bg-[#1e0a3c]/50 border-transparent hover:border-white/10 transition-all">
              <div className="prose prose-invert max-w-none">
                <p className="whitespace-pre-wrap leading-relaxed text-gray-200">{para.content}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <BookOpen className="w-10 h-10 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">This chapter is empty</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              The AI hasn't read this chapter yet. Click below to generate the learning modules.
            </p>
            
            <button
              onClick={handleGenerateChapterContent}
              disabled={isGenerating}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2"><Loader2 className="animate-spin" /> Writing...</span>
              ) : (
                "✨ Generate Chapter Content"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // --- 6. MAIN RENDER ---
  if (isLoadingData) return <div className="bg-[#13002b] h-screen text-white flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500"/></div>;

  return (
    <div className="flex h-screen bg-[#13002b] overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR */}
      <div className={`flex-shrink-0 bg-[#0a0212] border-r border-white/5 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-white font-semibold">Table of Contents</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => setSelectedChapter(chapter)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm text-left transition-colors ${selectedChapter?.id === chapter.id ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs font-mono">{chapter.order_index}</span>
              <span className="truncate flex-1">{chapter.title}</span>
              {chapter.start_page_num > 0 && <span className="text-[10px] text-gray-600">{chapter.start_page_num}</span>}
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-white/10 mt-auto">
          <button onClick={() => router.push('/dashboard')} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all border border-white/5 group">
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>
      </div>

      {/* MIDDLE SECTION */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#13002b] relative">
        {!isSidebarOpen && (
          <button onClick={() => setIsSidebarOpen(true)} className="absolute top-4 left-4 z-20 bg-[#1e0a3c] border border-white/10 p-2 rounded-lg text-white shadow-lg hover:bg-purple-600 transition-colors flex items-center gap-2">
            <Menu className="w-4 h-4" />
            <span className="text-xs font-medium">Chapters</span>
          </button>
        )}
        <div className="flex-1 overflow-hidden relative">
          {selectedChapter ? renderReader() : renderDashboard()}
        </div>
      </div>

      {/* RIGHT SIDEBAR (CHAT) */}
      <div className="w-[400px] flex-shrink-0 bg-[#0f0518] border-l border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5 bg-[#1e0a3c]/30">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            AI Tutor
            {selectedChapter && <span className="text-xs font-normal text-gray-500 ml-2">(Context: {selectedChapter.title})</span>}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
               <MessageSquare className="w-8 h-8 mb-2" />
               <p className="text-sm">Select a chapter and ask a question!</p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                  m.role === 'user' 
                  ? 'bg-purple-600 text-white rounded-br-none' 
                  : 'bg-[#1e0a3c] border border-white/10 text-gray-200 rounded-bl-none'
                }`}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {isAiThinking && (
            <div className="flex justify-start">
              <div className="bg-[#1e0a3c] border border-white/10 p-3 rounded-2xl rounded-bl-none">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-white/5 bg-[#0a0212]">
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!selectedChapter || isAiThinking}
              placeholder={selectedChapter ? "Ask about this chapter..." : "Select a chapter first"}
              className="w-full bg-[#1e0a3c] border border-white/10 text-white rounded-xl py-3 px-4 pr-12 focus:outline-none focus:border-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button 
              type="submit"
              disabled={!selectedChapter || !input.trim() || isAiThinking}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

    </div>
  );
};