"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  X,
  Send,
  MessageSquare,
  BookOpen,
  LogOut,
  Loader2,
  ChevronRight,
  AlertCircle,
  Trophy,       
  Flame,        
  PieChart,
  Clock,
  FileText
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ScheduleModal } from "../../components/ScheduleModal"; // Ensure this path is correct
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- TYPES ---

interface BookClientProps {
  bookId: string;
}

interface Chapter {
  id: string;
  title: string;
  order_index: number;
  start_page_num: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrl?: string; 
}

interface Paragraph {
  id: string;
  content: string;
  is_completed: boolean;
  order_index: number;
  section_title?: string;
  type?: 'text' | 'image' | 'code' | 'header'; 
  explanation?: string; 
}

interface Book {
  id: string;
  title: string;
  file_url: string;
  analogy_topic: string; // Dynamic Interest
  status: "pending" | "processing" | "completed" | "failed";
}

export const BookClient: React.FC<BookClientProps> = ({ bookId }) => {
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);

  // Stats State
  const [userXp, setUserXp] = useState(0);
  const [bookProgress, setBookProgress] = useState(0);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [bookStatus, setBookStatus] = useState<string>("pending");
  const [isGenerating, setIsGenerating] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Schedule & User
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"create" | "edit">("create");
  const [user, setUser] = useState<any>(null);
  const [analyzingParaId, setAnalyzingParaId] = useState<string | null>(null);

  // --- INITIALIZATION ---

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchStats(); 
  }, []);

  const fetchStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Get XP
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', user.id)
      .single();
    if (profile) setUserXp(profile.xp || 0);

    // 2. Calculate Progress
    const { count: total } = await supabase
      .from('paragraphs')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', bookId);

    const { count: completed } = await supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', bookId)
      .eq('is_completed', true);

    if (total && total > 0 && completed) {
      setBookProgress(Math.round((completed / total) * 100));
    }
  };

  const fetchBookData = async () => {
    if (!bookId) return;

    // Fetch Book
    const { data: bookData } = await supabase
      .from("course_books")
      .select("*")
      .eq("id", bookId)
      .single();

    if (bookData) {
      setBook(bookData);
      setBookStatus(bookData.status || "pending");
    }

    // Fetch Chapters
    const { data: chapterData } = await supabase
      .from("chapters")
      .select("*")
      .eq("book_id", bookId)
      .order("order_index", { ascending: true });

    if (chapterData) setChapters(chapterData);
    setIsLoadingData(false);
  };

  useEffect(() => { fetchBookData(); }, [bookId]);

  // Polling for status
  useEffect(() => {
    const interval = setInterval(() => {
      if (bookStatus === "processing") fetchBookData();
    }, 3000);
    return () => clearInterval(interval);
  }, [bookStatus, bookId]);

  // Load Paragraphs
  useEffect(() => {
    const loadParagraphs = async () => {
      if (!selectedChapter) return;
      const { data } = await supabase
        .from("paragraphs")
        .select("*")
        .eq("chapter_id", selectedChapter.id)
        .order("order_index", { ascending: true });
      setParagraphs(data || []);
      setIsGenerating(false);
    };
    loadParagraphs();
  }, [selectedChapter]);

  // Load Chat History
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!selectedChapter) return;
      const { data } = await supabase
        .from("chat_logs")
        .select("*")
        .eq("chapter_id", selectedChapter.id)
        .order("created_at", { ascending: true });

      if (data) {
        setMessages(data.map((m) => ({
          id: m.id,
          role: m.role as any,
          content: m.content,
        })));
      } else {
        setMessages([]);
      }
    };
    loadChatHistory();
  }, [selectedChapter]);


  // --- HANDLERS ---

  // 1. INGESTION HANDLER (This generates the Course Map)
  const handleGenerateMap = async () => {
    if (!book?.file_url) return alert("Error: Book URL missing");
    setIsGenerating(true);
    setBookStatus("processing");

    try {
      const response = await fetch(`${API_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: bookId,
          fileUrl: book.file_url,
          interest: book.analogy_topic || "General Learning", // Use real interest
          bookType: "Textbook",
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

  // 2. EXPLAIN HANDLER
  const handleExplainDiagram = async (para: Paragraph) => {
    setAnalyzingParaId(para.id);
    
    try {
      const res = await fetch(`${API_URL}/api/analyze-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraphId: para.id,
          imageUrl: para.content, 
          // FIX: Use dynamic interest
          analogyTopic: book?.analogy_topic || "General Learning", 
          context: selectedChapter?.title || "General Context"
        })
      });
      const data = await res.json();
      
      setParagraphs(prev => prev.map(p => 
        p.id === para.id ? { ...p, explanation: data.explanation } : p
      ));

      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: data.explanation,
          imageUrl: para.content 
        }
      ]);
    } catch (e) {
      console.error(e);
      alert("Failed to analyze image");
    } finally {
      setAnalyzingParaId(null);
    }
  };

  // 3. GENERATE CHAPTER HANDLER
  const handleGenerateChapterContent = async () => {
    if (!selectedChapter) return;
    setIsGenerating(true);
    try {
      await fetch(`${API_URL}/generate_chapter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: selectedChapter.id }),
      });
      
      // Poll
      const interval = setInterval(async () => {
        const { data } = await supabase
          .from("paragraphs")
          .select("*")
          .eq("chapter_id", selectedChapter.id)
          .order("order_index", { ascending: true });

        if (data && data.length > 0) {
          setParagraphs(data);
          setIsGenerating(false); 
          clearInterval(interval);
        }
      }, 3000);
    } catch (e: any) {
      alert("Error: " + e.message);
      setIsGenerating(false);
    }
  };

  // 4. CHAT HANDLER
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const userMessage: Message = { id: Date.now().toString(), role: "user", content: userText };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Shortcuts
    const cleanCommand = userText.toLowerCase().replace(/[^a-z]/g, "");
    if (activeParagraphId && ["yes", "next", "ok", "continue"].includes(cleanCommand)) {
      setTimeout(() => handleNextParagraph(), 500);
      return; 
    }

    if (!selectedChapter) return;
    setIsAiThinking(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chapterId: selectedChapter.id,
          currentParagraphId: activeParagraphId,
          userResponse: userText,
          userId: user?.id, 
          bookId: bookId,   
        }),
      });

      if (!response.body) return;
      const aiMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: aiMessageId, role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        accumulatedText += chunkValue;

        if (accumulatedText.toLowerCase().includes("[next]")) {
           const cleanText = accumulatedText.replace(/\[next\]/gi, "").trim();
           setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, content: cleanText } : msg));
           handleNextParagraph();
           return;
        }

        setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg));
      }

      if (accumulatedText.trim()) {
        supabase.from("chat_logs").insert({
          chapter_id: selectedChapter!.id,
          user_id: user?.id,
          role: "assistant",
          content: accumulatedText,
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleNextParagraph = async () => {
    if (!activeParagraphId) return;
    
    await supabase.from("paragraphs").update({ is_completed: true }).eq("id", activeParagraphId);
    
    setParagraphs((prev) => prev.map((p) => p.id === activeParagraphId ? { ...p, is_completed: true } : p));
    fetchStats(); 

    const currentIndex = paragraphs.findIndex((p) => p.id === activeParagraphId);
    const nextPara = paragraphs[currentIndex + 1];

    if (nextPara) {
      setActiveParagraphId(nextPara.id);
      triggerExplanation(nextPara.id);
    } else {
      setActiveParagraphId(null);
      setMessages(prev => [...prev, {id: Date.now().toString(), role: 'assistant', content: "🎉 Chapter completed!"}]);
    }
  };

  const triggerExplanation = async (paragraphId: string) => {
    setIsAiThinking(true);
    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ id: Date.now().toString(), role: "user", content: "Explain this paragraph." }], 
          chapterId: selectedChapter!.id,
          currentParagraphId: paragraphId, 
          userResponse: "Explain",
          userId: user?.id,
          bookId: bookId,
        }),
      });

      if (!response.body) return;
      const aiMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: aiMessageId, role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        accumulatedText += decoder.decode(value, { stream: true });
        
        if (accumulatedText.toLowerCase().includes("[next]")) {
            setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, content: accumulatedText.replace(/\[next\]/gi, "") } : msg));
            return;
        }
        setMessages((prev) => prev.map((msg) => msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg));
      }
    } catch (e) { console.error(e); } 
    finally { setIsAiThinking(false); }
  };

  const groupParagraphsBySection = (list: Paragraph[]) => {
    const sections: { title: string; paragraphs: Paragraph[] }[] = [];
    list.forEach((p) => {
      const lastSection = sections[sections.length - 1];
      const currentTitle = p.section_title || "General";
      if (lastSection && lastSection.title === currentTitle) {
        lastSection.paragraphs.push(p);
      } else {
        sections.push({ title: currentTitle, paragraphs: [p] });
      }
    });
    return sections;
  };

  const startAiSession = (section: { paragraphs: Paragraph[] }) => {
    const nextPara = section.paragraphs.find((p) => !p.is_completed);
    if (nextPara) {
      setActiveParagraphId(nextPara.id);
      triggerExplanation(nextPara.id);
    } else {
      setActiveParagraphId(null);
    }
  };

  // --- RENDERERS ---

  // A. RENDER DASHBOARD (Missing in previous response)
  const renderDashboard = () => (
    <div className="h-full w-full overflow-y-auto p-10 relative">
      <div className="max-w-5xl mx-auto pb-20">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">{book?.title || "Loading..."}</h1>
          <div className="flex justify-center mt-4">
             <span className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase ${
                bookStatus === "completed" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                bookStatus === "processing" ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse" :
                bookStatus === "failed" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                "bg-gray-800 text-gray-400 border-gray-700"
             }`}>{bookStatus}</span>
          </div>
        </div>

        {/* PROCESSING STATE */}
        {bookStatus === "processing" && (
          <div className="text-center py-20 border-2 border-dashed border-blue-500/30 rounded-3xl bg-blue-500/5 animate-pulse">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Analyzing Book Structure...</h2>
            <p className="text-blue-200/60">AI is reading the Table of Contents.</p>
          </div>
        )}

        {/* PENDING STATE - SHOW GENERATE BUTTON */}
        {bookStatus === "pending" && (
          <div className="text-center py-24 border-2 border-dashed border-white/10 rounded-3xl bg-white/5">
            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Organize</h2>
            <button
              onClick={handleGenerateMap}
              disabled={isGenerating}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 inline-flex items-center"
            >
              {isGenerating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : "✨ Generate Course Map"}
            </button>
          </div>
        )}

        {/* FAILED STATE */}
        {bookStatus === "failed" && (
          <div className="text-center py-12 bg-red-900/10 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white">Scan Failed</h3>
            <button onClick={() => setBookStatus("pending")} className="mt-4 text-red-300 underline">Try Again</button>
          </div>
        )}

        {/* COMPLETED STATE - SHOW CHAPTERS */}
        {(bookStatus === "completed" || chapters.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => setSelectedChapter(chapter)}
                className="text-left bg-[#1e0a3c] hover:bg-[#2a1352] border border-white/5 p-6 rounded-2xl hover:-translate-y-1 transition-all"
              >
                <div className="flex justify-between mb-4">
                  <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 px-2 py-1 rounded">CH {chapter.order_index}</span>
                  {chapter.start_page_num > 0 && <span className="text-[10px] text-gray-500">Pg {chapter.start_page_num}</span>}
                </div>
                <h3 className="text-lg font-bold text-white line-clamp-2">{chapter.title}</h3>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // B. RENDER READER
  const renderReader = () => {
    const groupedSections = groupParagraphsBySection(paragraphs);

    return (
      <div className="max-w-3xl mx-auto w-full p-8 space-y-8 pb-20">
        
        {/* STATS BAR */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-xl mb-8 backdrop-blur-md sticky top-0 z-10 shadow-lg">
          <div className="flex items-center gap-3">
             <div className="bg-orange-500/20 p-2 rounded-lg"><Flame className="w-5 h-5 text-orange-400" /></div>
             <div><p className="text-[10px] uppercase text-gray-500 font-bold">Interest</p><p className="text-sm font-bold text-white capitalize">{book?.analogy_topic || "General"}</p></div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex items-center gap-3">
             <div className="bg-blue-500/20 p-2 rounded-lg"><PieChart className="w-5 h-5 text-blue-400" /></div>
             <div><p className="text-[10px] uppercase text-gray-500 font-bold">Progress</p><p className="text-sm font-bold text-white">{bookProgress}% Done</p></div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex items-center gap-3">
             <div className="bg-yellow-500/20 p-2 rounded-lg"><Trophy className="w-5 h-5 text-yellow-400" /></div>
             <div><p className="text-[10px] uppercase text-gray-500 font-bold">Total XP</p><p className="text-sm font-bold text-white">{userXp} XP</p></div>
          </div>
        </div>

        {groupedSections.length === 0 && (
          <div className="text-center py-20">
             <button
              onClick={handleGenerateChapterContent}
              disabled={isGenerating}
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
            >
              {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : "✨ Generate Chapter Content"}
            </button>
          </div>
        )}

        {groupedSections.map((section, secIdx) => {
          const isSectionComplete = section.paragraphs.every(p => p.is_completed);
          return (
            <div key={secIdx} className={`relative group rounded-2xl p-6 border-2 transition-all ${isSectionComplete ? 'border-green-500/20 bg-green-500/5' : 'border-transparent hover:border-white/10 hover:bg-[#1e0a3c]'}`}>
              <h3 className="text-xl font-bold text-white mb-6 pl-2 border-l-4 border-purple-500">{section.title}</h3>
              
              <div className="absolute -right-4 top-6 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button onClick={(e) => { e.stopPropagation(); startAiSession(section); }} className="bg-purple-600 text-white p-2 rounded-lg shadow-lg hover:scale-105 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> <span className="text-xs font-bold">Study</span>
                </button>
              </div>

              <div className="space-y-6">
                {section.paragraphs.map((para) => {
                  if (para.type === 'image') return (
                    <div key={para.id} className="flex flex-col items-center p-4 rounded-xl border border-white/5 bg-black/20">
                      <img src={para.content} alt="Diagram" className="max-h-[350px] rounded-lg object-contain" />
                      {para.explanation ? (
                         <div className="mt-4 w-full bg-blue-900/20 border-l-4 border-cyan-400 p-4 rounded-r-lg text-sm text-gray-200">
                            <strong className="text-cyan-400 block mb-1 text-xs">AI VISION ANALYSIS</strong>
                            {para.explanation}
                         </div>
                      ) : (
                         <button onClick={() => handleExplainDiagram(para)} disabled={analyzingParaId === para.id} className="mt-3 px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-full text-blue-300 text-xs font-bold flex gap-2">
                           {analyzingParaId === para.id ? <Loader2 className="w-3 h-3 animate-spin"/> : "✨ Explain Diagram"}
                         </button>
                      )}
                    </div>
                  );
                  // Text/Math
                  return (
                    <div key={para.id} className={`text-gray-300 p-4 rounded-lg transition-all ${para.is_completed ? 'border-b border-green-500/30 text-gray-500' : 'bg-white/5'} ${activeParagraphId === para.id ? 'bg-purple-900/20 ring-1 ring-purple-500' : ''}`}>
                       <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{p: ({node, ...props}) => <p className="mb-0" {...props} />}}>
                         {para.content}
                       </ReactMarkdown>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // --- MAIN UI ---
  if (isLoadingData) return <div className="bg-[#13002b] h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>;

  return (
    <div className="flex h-screen bg-[#13002b] text-white overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR */}
      <div className={`flex-shrink-0 bg-[#0a0212] border-r border-white/5 flex flex-col transition-all ${isSidebarOpen ? "w-72" : "w-0 overflow-hidden"}`}>
         <div className="p-4 border-b border-white/5 flex justify-between"><h2 className="font-semibold">Table of Contents</h2><button onClick={()=>setIsSidebarOpen(false)}><X className="w-5 h-5"/></button></div>
         <div className="flex-1 overflow-y-auto p-2">
           {chapters.map((c) => (
             <button key={c.id} onClick={() => setSelectedChapter(c)} className={`w-full text-left p-3 rounded-lg text-sm mb-1 ${selectedChapter?.id === c.id ? "bg-purple-600/20 text-purple-300" : "text-gray-400 hover:bg-white/5"}`}>
               <span className="mr-2 font-mono text-xs opacity-50">{c.order_index}.</span> {c.title}
             </button>
           ))}
         </div>
         <button onClick={()=>router.push("/dashboard")} className="m-4 p-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-sm"><LogOut className="w-4 h-4"/> Back to Dashboard</button>
      </div>

      {/* CENTER AREA (DASHBOARD OR READER) */}
      <div className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-purple-600/30">
        {!isSidebarOpen && <button onClick={()=>setIsSidebarOpen(true)} className="absolute top-4 left-4 z-20 bg-[#1e0a3c] p-2 rounded-lg border border-white/10 shadow-lg"><Menu className="w-4 h-4"/></button>}
        
        {/* LOGIC TOGGLE */}
        {selectedChapter ? renderReader() : renderDashboard()}
      
      </div>

      {/* RIGHT SIDEBAR (CHAT) */}
      <div className="w-[400px] bg-[#0f0518] border-l border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5 bg-[#1e0a3c]/50">
           <h2 className="font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-purple-400"/> AI Tutor</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
           {messages.map((m) => (
             <div key={m.id} className={`flex ${m.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role==='user'?'bg-purple-600 text-white rounded-br-none':'bg-[#1e0a3c] border border-white/10 text-gray-200 rounded-bl-none'}`}>
                   {m.imageUrl && <img src={m.imageUrl} className="mb-2 rounded-lg border border-white/10"/>}
                   <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
             </div>
           ))}
           {isAiThinking && <div className="flex justify-start"><div className="bg-[#1e0a3c] p-3 rounded-2xl rounded-bl-none"><Loader2 className="w-4 h-4 animate-spin text-purple-400"/></div></div>}
           <div ref={messagesEndRef} />
        </div>
        <div className="p-4 bg-[#0a0212] border-t border-white/5">
           <form onSubmit={handleSendMessage} className="relative">
             <input type="text" value={input} onChange={(e)=>setInput(e.target.value)} disabled={!selectedChapter||isAiThinking} placeholder="Ask a question..." className="w-full bg-[#1e0a3c] border border-white/10 rounded-xl py-3 px-4 pr-12 focus:border-purple-500 outline-none"/>
             <button type="submit" disabled={!input.trim()||isAiThinking} className="absolute right-2 top-2.5 p-1.5 bg-purple-600 rounded-lg"><Send className="w-4 h-4"/></button>
           </form>
        </div>
      </div>

    </div>
  );
};