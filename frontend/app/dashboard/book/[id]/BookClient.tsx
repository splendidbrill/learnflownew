"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Menu, X, Send, MessageSquare, BookOpen, 
  CheckCircle, LogOut, Loader2, FileText, ChevronRight, AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { div } from 'framer-motion/client';

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
  section_title?: string; // <--- ADD THIS
  order_index: number;
  explanation?: string;   // Add this too if you want to cache explanations
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
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);
  
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

  useEffect(() => {
    setIsGenerating(false);
  }, [selectedChapter]);

  // 1. ADD: Load Chat History when Chapter changes
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!selectedChapter) return;
      
      const { data } = await supabase
        .from('chat_logs')
        .select('*')
        .eq('chapter_id', selectedChapter.id)
        .order('created_at', { ascending: true });
        
      if (data) {
        // Map DB structure to UI structure
        setMessages(data.map(m => ({ id: m.id, role: m.role as any, content: m.content })));
      } else {
        setMessages([]);
      }
    };
    loadChatHistory();
  }, [selectedChapter]);

  // 2. ADD: Helper to Save Message to DB
  const addMessageToDb = async (role: 'user' | 'assistant', content: string) => {
    // Only save if we have a chapter and user
    // (Assuming you have 'user' object from props, if not, get it from supabase.auth.getUser())
    if (!selectedChapter) return;
    
    // Optimistic UI Update (Show it immediately)
    const tempId = Date.now().toString();
    setMessages(prev => [...prev, { id: tempId, role, content }]);

    const { data, error } = await supabase.from('chat_logs').insert({
      chapter_id: selectedChapter.id,
      user_id: (await supabase.auth.getUser()).data.user?.id, 
      role, 
      content
    }).select().single();
    
    // Update the temp ID with real DB ID (optional but good practice)
    if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m));
    }
  };

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
    if (!input.trim()) return;

    const userText = input.trim();
    
    // 1. Add User Message to Chat UI immediately
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: userText };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    // --- NEW LOGIC: Navigation Interceptor ---
    // If the user says a "move on" keyword, handle it locally.
    // We strip punctuation/spaces to match "yes." or "next!"
    const cleanCommand = userText.toLowerCase().replace(/[^a-z]/g, '');
    const navKeywords = ['yes', 'next', 'ok', 'okay', 'sure', 'continue', 'goahead', 'ready'];

    // Only intercept if we have an active paragraph (meaning we are in a session)
    if (activeParagraphId && navKeywords.includes(cleanCommand)) {
       // Simulate a small delay for natural feel, then move
       setTimeout(() => {
         handleNextParagraph();
       }, 500);
       return; // <--- STOP HERE. Do not send to API.
    }
    // -----------------------------------------

    if (!selectedChapter) return;
    setIsAiThinking(true);

    try {
      const payload = {
        messages: [...messages, userMessage],
        chapterId: selectedChapter.id,
        currentParagraphId: activeParagraphId, 
        userResponse: userText 
      };

      const response = await fetch('http://localhost:8000/chat', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

        // Still keep this just in case the AI triggers it during a Q&A session
        if (accumulatedText.toLowerCase().includes("[next]")) {
           const cleanText = accumulatedText.replace(/\[next\]/gi, "").trim();
           if (cleanText) {
             setMessages(prev => prev.map(msg => 
               msg.id === aiMessageId ? { ...msg, content: cleanText } : msg
             ));
           } else {
             setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
           }
           handleNextParagraph(); 
           return; 
        }

        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg
        ));
      }
      if (accumulatedText.trim()) {
    // We already updated the UI state during streaming, 
    // now just background save to DB
    supabase.from('chat_logs').insert({
      chapter_id: selectedChapter!.id,
      user_id: (await supabase.auth.getUser()).data.user?.id,
      role: 'assistant',
      content: accumulatedText
    });
}
      
    } catch (error: any) {
      console.error(error);
      // Fallback message in chat if error
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "I'm having trouble connecting. Try clicking 'Study Section' again." }]);
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

  const groupParagraphsBySection = (list: Paragraph[]) => {
    const sections: { title: string; paragraphs: Paragraph[] }[] = [];
    
    list.forEach((p) => {
      const lastSection = sections[sections.length - 1];
      // Check if this paragraph belongs to the same section as the last one
      // If section_title is missing, we group it under "General"
      const currentTitle = p.section_title || 'General';

      if (lastSection && lastSection.title === currentTitle) {
        lastSection.paragraphs.push(p);
      } else {
        sections.push({ 
          title: currentTitle, 
          paragraphs: [p] 
        });
      }
    });
    
    return sections;
  };

  // const startAiSession = (section: { title: string; paragraphs: Paragraph[] }) => {
  //   // 1. Open the Chat Sidebar if it's not open (Optional, based on your UI preference)
  //   // setIsSidebarOpen(true); 

  //   // 2. Find the first paragraph that is NOT completed
  //   const nextPara = section.paragraphs.find(p => !p.is_completed);

  //   let initialMessage = "";
    
  //   if (!nextPara) {
  //     // Case A: Section is 100% complete
  //     initialMessage = `You have completed the section "**${section.title}**". Good job! Do you want to review specific concepts?`;
  //     setActiveParagraphId(null);
  //   } else {
  //     // Case B: Section has remaining work
  //     const isFirst = nextPara.id === section.paragraphs[0].id;
  //     setActiveParagraphId(nextPara.id); // <--- Important: This sets the "Cursor"
      
  //     if (isFirst) {
  //       initialMessage = `I see you are starting "**${section.title}**". It has ${section.paragraphs.length} paragraphs. Shall we start with the first one?`;
  //     } else {
  //       // Calculate how many they finished
  //       const doneCount = section.paragraphs.indexOf(nextPara);
  //       initialMessage = `Welcome back to "**${section.title}**". You've finished ${doneCount} paragraphs. Ready to tackle paragraph #${doneCount + 1}?`;
  //     }
  //   }

  //   // 3. Inject the greeting into the Chat
  //   setMessages(prev => [
  //     ...prev, 
  //     { 
  //       id: Date.now().toString(), 
  //       role: 'assistant', 
  //       content: initialMessage 
  //     }
  //   ]);
  // };

  const startAiSession = (section: { title: string; paragraphs: Paragraph[] }) => {
    // Find the first one that is NOT completed
    const nextPara = section.paragraphs.find(p => !p.is_completed);
    
    if (!nextPara) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: `You've already finished **${section.title}**. Do you have any specific questions about it?` }]);
      setActiveParagraphId(null);
    } else {
      setActiveParagraphId(nextPara.id);
      
      const doneCount = section.paragraphs.indexOf(nextPara);
      const total = section.paragraphs.length;
      
      // Clear previous chat or add a divider? Let's add a divider.
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', // Use a special style for this if you want
        content: `--- ${section.title} (${doneCount}/${total} done) ---` 
      }]);

      // AUTO-DRIVE: Explain immediately.
      triggerExplanation(nextPara.id);
    }
  };

  const triggerExplanation = async (paragraphId: string) => {
    setIsAiThinking(true);
    
    // We send a hidden "System" instruction from the user's perspective
    // This forces the AI to enter "Explanation Mode" for the new paragraph
    const hiddenMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: "Explain this paragraph to me." 
    };

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [hiddenMessage], // We start a fresh context for the new paragraph
          chapterId: selectedChapter!.id,
          currentParagraphId: paragraphId, // <--- Send the NEW ID explicitly
          userResponse: "Explain"
        }),
      });

      if (!response.body) return;

      // Create a new Assistant Message bubble
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

        if (accumulatedText.toLowerCase().includes("[next]")) {
           // Skip moving forward here (prevents infinite loop), just hide the tag
           // or if you want it to auto-skip empty explanations:
           const cleanText = accumulatedText.replace(/\[next\]/gi, "").trim();
           setMessages(prev => prev.map(msg => 
             msg.id === aiMessageId ? { ...msg, content: cleanText } : msg
           ));
           return; 
        }

        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg
        ));
      }
      if (accumulatedText.trim()) {
        // We already updated the UI state during streaming, 
        // now just background save to DB
        supabase.from('chat_logs').insert({
          chapter_id: selectedChapter!.id,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          role: 'assistant',
          content: accumulatedText
        });
    }


    } catch (e) {
      console.error(e);
    } finally {
      setIsAiThinking(false);
    }
  };

  // const handleNextParagraph = () => {
  //   if (!activeParagraphId) return;

  //   // 1. Mark current as complete locally
  //   setParagraphs(prev => prev.map(p => 
  //     p.id === activeParagraphId ? { ...p, is_completed: true } : p
  //   ));

  //   // (Optional: Save to DB here via Supabase)
  //   // supabase.table('user_progress').insert(...)

  //   // 2. Find the NEXT paragraph in the same section
  //   const flatList = paragraphs; 
  //   const currentIndex = flatList.findIndex(p => p.id === activeParagraphId);
  //   const nextPara = flatList[currentIndex + 1];

  //   if (nextPara) {
  //     // Move to next
  //     setActiveParagraphId(nextPara.id);
      
  //     // 3. Trigger AI automatically for the new paragraph
  //     // We simulate a user message "Explain" but hide it, or just send a hidden request
  //     // For MVP, let's just let the user know:
  //     setMessages(prev => [
  //       ...prev,
  //       { id: Date.now().toString(), role: 'assistant', content: "Moving to the next paragraph... Shall I explain it?" }
  //     ]);
  //   } else {
  //     // Section done
  //     setActiveParagraphId(null);
  //     setMessages(prev => [
  //       ...prev,
  //       { id: Date.now().toString(), role: 'assistant', content: "🎉 Section completed! Great work." }
  //     ]);
  //   }
  // };

  // const handleNextParagraph = async () => { // Make async
  //   if (!activeParagraphId) return;

  //   // 1. SAVE TO DATABASE (The Fix for "Forgetting")
  //   const { error } = await supabase
  //     .from('paragraphs')
  //     .update({ is_completed: true })
  //     .eq('id', activeParagraphId);

  //   if (error) console.error("Failed to save progress:", error);

  //   // 2. Update Local State
  //   setParagraphs(prev => prev.map(p => 
  //     p.id === activeParagraphId ? { ...p, is_completed: true } : p
  //   ));

  //   // 3. Find Next Paragraph
  //   const flatList = paragraphs; 
  //   const currentIndex = flatList.findIndex(p => p.id === activeParagraphId);
  //   const nextPara = flatList[currentIndex + 1];

  //   if (nextPara) {
  //     setActiveParagraphId(nextPara.id);
  //     // 4. AUTO-DRIVE: Go straight to explanation, don't ask.
  //     triggerExplanation(nextPara.id); 
  //   } else {
  //     setActiveParagraphId(null);
  //     setMessages(prev => [
  //       ...prev,
  //       { id: Date.now().toString(), role: 'assistant', content: "🎉 Section completed! Great work." }
  //     ]);
  //   }
  // };
  const handleNextParagraph = async () => {
    if (!activeParagraphId) return;

    // 1. Save Progress
    await supabase.from('paragraphs').update({ is_completed: true }).eq('id', activeParagraphId);

    // 2. Update Local
    setParagraphs(prev => prev.map(p => p.id === activeParagraphId ? { ...p, is_completed: true } : p));

    // 3. Find Next
    const currentIndex = paragraphs.findIndex(p => p.id === activeParagraphId);
    const currentPara = paragraphs[currentIndex];
    const nextPara = paragraphs[currentIndex + 1];

    if (nextPara) {
      setActiveParagraphId(nextPara.id);

      // --- NEW SECTION DETECTION ---
      const currentSectionTitle = currentPara.section_title || 'General';
      const nextSectionTitle = nextPara.section_title || 'General';

      if (currentSectionTitle !== nextSectionTitle) {
         // Calculate stats for the NEW section
         const newSectionParas = paragraphs.filter(p => (p.section_title || 'General') === nextSectionTitle);
         const total = newSectionParas.length;
         
         // Insert Divider into Chat
         addMessageToDb('assistant', `--- Starting: ${nextSectionTitle} (0/${total}) ---`);
      }
      // -----------------------------

      triggerExplanation(nextPara.id); 
    } else {
      setActiveParagraphId(null);
      addMessageToDb('assistant', "🎉 Chapter completed! Great work.");
    }
  };

  const currentParaObj = paragraphs.find(p => p.id === activeParagraphId);
const currentSectionTitle = currentParaObj?.section_title || 'General';
const sectionParas = paragraphs.filter(p => (p.section_title || 'General') === currentSectionTitle);
const completedInThisSection = sectionParas.filter(p => p.is_completed).length;

  const renderReader = () => {
    const groupedSections = groupParagraphsBySection(paragraphs);

    return (
      <div className="h-full w-full overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-purple-500/20 scrollbar-track-transparent">
      <div className="max-w-3xl mx-auto w-full p-8 space-y-12 pb-20">
        
        {/* --- EMPTY STATE WITH GENERATE BUTTON --- */}
        {groupedSections.length === 0 && (
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
              className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating content...
                </>
              ) : (
                "✨ Generate Chapter Content"
              )}
            </button>
          </div>
        )}

        {/* --- CONTENT SECTIONS --- */}
        {groupedSections.map((section, secIdx) => {
          const isSectionComplete = section.paragraphs.every(p => p.is_completed);

          return (
            <div 
              key={secIdx} 
              className={`relative group rounded-2xl p-6 transition-all border-2 ${
                isSectionComplete 
                  ? 'border-orange-500/50 bg-orange-500/5' 
                  : 'border-transparent hover:border-white/10 hover:bg-[#1e0a3c]'
              }`}
            >
              {/* Section Header */}
              <h3 className="text-xl font-bold text-white mb-6 pl-2 border-l-4 border-purple-500">
                {section.title}
              </h3>

              {/* Study Button (Visible on Hover) */}
              <div className="absolute -right-4 top-6 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    startAiSession(section);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-cyan-500 text-white p-2 rounded-lg shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-xs font-bold whitespace-nowrap">Study Section</span>
                </button>
              </div>

              {/* Paragraphs */}
              <div className="space-y-4">
                {section.paragraphs.map((para) => (
                  <div 
                  key={para.id} 
                  className={`
                    text-gray-300 leading-relaxed p-4 rounded-lg transition-all duration-500
                    ${para.is_completed ? 'border-b-2 border-dotted border-orange-500 text-gray-500' : 'bg-white/5'}
                    ${activeParagraphId === para.id 
                       ? 'bg-purple-900/40 border-l-4 border-purple-400 ring-1 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] transform scale-[1.02]' 
                       : ''}
                  `}
                >
                    {para.content}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    );
  };

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
      {/* <div className="w-[400px] flex-shrink-0 bg-[#0f0518] border-l border-white/5 flex flex-col">
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
      </div> */}
      {/* RIGHT SIDEBAR (CHAT) */}
      <div className="w-[400px] flex-shrink-0 bg-[#0f0518] border-l border-white/5 flex flex-col">
        
        {/* 1. HEADER WITH PROGRESS */}
        <div className="p-4 border-b border-white/5 bg-[#1e0a3c]/30 transition-all">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            AI Tutor
            {!activeParagraphId && selectedChapter && (
              <span className="text-xs font-normal text-gray-500 ml-2 truncate max-w-[150px]">
                (Context: {selectedChapter.title})
              </span>
            )}
          </h2>

          {/* Dynamic Progress Bar */}
          {activeParagraphId && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-purple-300 font-bold truncate max-w-[200px]">
                  {currentSectionTitle}
                </span>
                <span className="text-gray-400">
                  {completedInThisSection} / {sectionParas.length} done
                </span>
              </div>
              
              <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-500"
                  style={{ width: `${(completedInThisSection / (sectionParas.length || 1)) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. CHAT MESSAGES AREA */}
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
                  : m.role === 'assistant' 
                    ? 'bg-[#1e0a3c] border border-white/10 text-gray-200 rounded-bl-none'
                    : 'w-full text-center text-xs text-gray-500 my-2 border-b border-white/5 leading-[0.1em]' // System/Divider style
                }`}>
                  {m.role === 'assistant' ? (
                     <span className="bg-[#0f0518] px-2">{m.content}</span>
                  ) : (
                     m.content
                  )}
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

        {/* 3. INPUT AREA */}
        <div className="p-4 border-t border-white/5 bg-[#0a0212]">
          <form onSubmit={handleSendMessage} className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!selectedChapter || isAiThinking}
              placeholder={activeParagraphId ? "Ask a question or type 'Next'" : "Select a chapter first"}
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