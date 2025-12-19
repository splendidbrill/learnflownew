// "use client";

// import React, { useEffect, useState } from 'react';
// import { useRouter } from 'next/navigation';
// import { ArrowLeft, Book as BookIcon, User, FileText, Calendar } from 'lucide-react';
// import { createClient } from '@/lib/supabase/client';
// import { Book } from '../../types'; // Ensure this path points to your types file

// interface BookClientProps {
//   bookId: string;
// }

// export const BookClient: React.FC<BookClientProps> = ({ bookId }) => {
//   const router = useRouter();
//   const supabase = createClient();
//   const [book, setBook] = useState<any | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   useEffect(() => {
//     const fetchBookDetails = async () => {
//       try {
//         setLoading(true);
//         // 1. Fetch from the NEW table 'course_books'
//         // We also join 'courses' to get the subject color and name
//         const { data, error } = await supabase
//           .from('course_books')
//           .select(`
//             *,
//             courses (
//               name,
//               color
//             )
//           `)
//           .eq('id', bookId)
//           .single();

//         if (error) throw error;
//         setBook(data);
//       } catch (err: any) {
//         console.error('Error fetching book:', err);
//         setError(err.message);
//       } finally {
//         setLoading(false);
//       }
//     };

//     if (bookId) {
//       fetchBookDetails();
//     }
//   }, [bookId, supabase]);

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-[#13002b] flex items-center justify-center text-white">
//         <div className="flex flex-col items-center gap-4">
//           <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
//           <p>Loading book...</p>
//         </div>
//       </div>
//     );
//   }

//   if (error || !book) {
//     return (
//       <div className="min-h-screen bg-[#13002b] flex flex-col items-center justify-center text-white p-6">
//         <h1 className="text-2xl font-bold mb-2">Book not found</h1>
//         <p className="text-red-400 mb-6">{error || "This book doesn't exist or was deleted."}</p>
//         <button 
//           onClick={() => router.push('/dashboard')}
//           className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center gap-2"
//         >
//           <ArrowLeft className="w-4 h-4" /> Back to Dashboard
//         </button>
//       </div>
//     );
//   }

//   // Use color from the joined course, or default to purple
//   const accentColor = book.courses?.color || '#a855f7';

//   return (
//     <div className="min-h-screen bg-[#13002b] text-white">
//       {/* Header / Navbar */}
//       <header className="border-b border-white/10 bg-[#1e0a3c]/50 backdrop-blur-md sticky top-0 z-10">
//         <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
//           <button 
//             onClick={() => router.push('/dashboard')}
//             className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
//           >
//             <ArrowLeft className="w-5 h-5" />
//           </button>
          
//           <div className="h-6 w-[1px] bg-white/10" />
          
//           <div className="flex items-center gap-3">
//              <div 
//                className="w-8 h-8 rounded-lg flex items-center justify-center"
//                style={{ backgroundColor: `${accentColor}30` }}
//              >
//                <BookIcon className="w-4 h-4" style={{ color: accentColor }} />
//              </div>
//              <div>
//                <h1 className="font-semibold text-sm md:text-base leading-tight">{book.title}</h1>
//                <p className="text-xs text-gray-400 flex items-center gap-1">
//                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: accentColor }} />
//                  {book.courses?.name || 'Untitled Subject'}
//                </p>
//              </div>
//           </div>
//         </div>
//       </header>

//       {/* Main Content */}
//       <main className="max-w-7xl mx-auto p-6 md:p-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
//         {/* Left Column: Details */}
//         <div className="space-y-6">
//           <div className="bg-[#1e0a3c] border border-white/5 rounded-2xl p-6">
//             <h2 className="text-lg font-semibold mb-4 text-purple-200">Book Details</h2>
            
//             <div className="space-y-4">
//               {book.author && (
//                 <div className="flex items-start gap-3 text-sm">
//                   <User className="w-4 h-4 text-gray-400 mt-0.5" />
//                   <div>
//                     <p className="text-gray-400 text-xs uppercase tracking-wider">Author</p>
//                     <p className="text-white font-medium">{book.author}</p>
//                   </div>
//                 </div>
//               )}
              
//               {book.created_at && (
//                 <div className="flex items-start gap-3 text-sm">
//                   <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
//                   <div>
//                     <p className="text-gray-400 text-xs uppercase tracking-wider">Added On</p>
//                     <p className="text-white font-medium">
//                       {new Date(book.created_at).toLocaleDateString()}
//                     </p>
//                   </div>
//                 </div>
//               )}

//               <div className="flex items-start gap-3 text-sm">
//                  <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
//                  <div>
//                    <p className="text-gray-400 text-xs uppercase tracking-wider">Format</p>
//                    <p className="text-white font-medium">PDF Document</p>
//                  </div>
//               </div>
//             </div>
//           </div>

//           <div className="bg-[#1e0a3c] border border-white/5 rounded-2xl p-6">
//              <h2 className="text-lg font-semibold mb-2 text-purple-200">Description</h2>
//              <p className="text-gray-300 text-sm leading-relaxed">
//                {book.description || "No description provided for this book."}
//              </p>
//           </div>
          
//           {book.analogy_topic && (
//             <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-white/10 rounded-2xl p-6">
//                <h2 className="text-lg font-semibold mb-2 text-white">AI Context</h2>
//                <p className="text-sm text-gray-300 mb-1">
//                  This book will be explained using analogies from:
//                </p>
//                <p className="text-lg font-bold text-purple-300">
//                  {book.analogy_topic}
//                </p>
//             </div>
//           )}
//         </div>

//         {/* Right Column: PDF Viewer / Content */}
//         <div className="lg:col-span-2 min-h-[500px] bg-[#0f0518] rounded-2xl border border-white/10 overflow-hidden flex flex-col">
//           {book.file_url ? (
//             <iframe 
//               src={book.file_url} 
//               className="w-full h-full min-h-[600px]"
//               title="PDF Viewer"
//             />
//           ) : (
//              <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-10 text-center">
//                <FileText className="w-12 h-12 mb-4 opacity-50" />
//                <p>No file attached to this book.</p>
//              </div>
//           )}
//         </div>

//       </main>
//     </div>
//   );
// };

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
  start_page_num: number; // NEW: Added for page mapping
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
  status: 'pending' | 'processing' | 'completed' | 'failed'; // NEW: Status tracking
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
  const [bookStatus, setBookStatus] = useState<string>("pending"); // NEW
  const [isGenerating, setIsGenerating] = useState(false); // NEW

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // --- 3. DATA FETCHING & POLLING ---
  
  const fetchBookData = async () => {
    if (!bookId) return;

    // A. Fetch Book
    // NOTE: using 'books' table to match backend. If your table is 'course_books', change it here.
    const { data: bookData } = await supabase
      .from('course_books') 
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

  // Initial Load
  useEffect(() => {
    fetchBookData();
  }, [bookId]);

  // Polling Effect (The Live Watcher)
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if backend is working
      if (bookStatus === "processing") {
        console.log("🔄 Polling backend status...");
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

  // --- 4. HANDLERS ---

  // Generate Map Handler (Connects to Python Backend)
  const handleGenerateMap = async () => {
    if (!book?.file_url) return alert("Error: Book URL missing");
    
    setIsGenerating(true);
    setBookStatus("processing"); // Instant UI update

    try {
      const response = await fetch("http://localhost:8000/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: bookId,
          fileUrl: book.file_url,
          interest: "General Learning", // Dynamic later
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

  // Chat Handler
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

  // --- 5. SUB-COMPONENTS ---

  // The Grid View (Status & Chapter List)
 // The Grid View (Status & Chapter List)
 const renderDashboard = () => (
  <div className="h-full overflow-y-auto w-full animate-in fade-in duration-500 scrollbar-thin scrollbar-thumb-purple-900/50 p-10">
    
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-400">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{book?.title || 'Loading Book...'}</h1>
        
        {/* Status Badge */}
        <div className="flex justify-center mt-4">
          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
            bookStatus === 'completed' ? 'bg-green-900/20 text-green-400 border-green-500/30' :
            bookStatus === 'processing' ? 'bg-blue-900/20 text-blue-400 border-blue-500/30 animate-pulse' :
            bookStatus === 'failed' ? 'bg-red-900/20 text-red-400 border-red-500/30' :
            'bg-gray-800 text-gray-400 border-gray-700'
          }`}>
            Status: {bookStatus.toUpperCase()}
          </span>
        </div>
      </div>

      {/* --- STATUS STATES --- */}
      
      {/* 1. Processing State */}
      {bookStatus === "processing" && (
        <div className="text-center py-16 border-2 border-dashed border-blue-500/30 rounded-2xl bg-blue-500/5 animate-pulse">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white">Scanning Book Structure...</h2>
          <p className="text-gray-400 mt-2">
            AI is reading the Table of Contents.<br/>
            Chapters will appear below automatically.
          </p>
        </div>
      )}

      {/* 2. Pending State (The Big Button) */}
      {bookStatus === "pending" && (
        <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Ready to Process</h2>
          <p className="text-gray-400 mb-8 max-w-md mx-auto">
            Scan the book to generate a clickable map of chapters.
          </p>
          
          <button 
            onClick={handleGenerateMap}
            disabled={isGenerating}
            className="group px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-purple-500/25 flex items-center gap-2 mx-auto disabled:opacity-50"
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Starting AI...</>
            ) : (
              <>✨ Generate Course Map <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>
            )}
          </button>
        </div>
      )}

      {/* 3. Failed State */}
      {bookStatus === "failed" && (
        <div className="text-center py-10 bg-red-900/10 border border-red-500/20 rounded-xl">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h3 className="text-white font-bold">Processing Failed</h3>
          <button onClick={() => setBookStatus('pending')} className="text-sm text-red-400 hover:text-red-300 underline mt-2">Try Again</button>
        </div>
      )}

      {/* 4. Completed/Existing State (Chapter Grid) */}
      {(bookStatus === "completed" || chapters.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8 pb-10">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => setSelectedChapter(chapter)}
              className="group text-left bg-[#1e0a3c] hover:bg-[#2a1352] border border-white/5 hover:border-purple-500/50 p-6 rounded-xl transition-all hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                  CH {chapter.order_index}
                </span>
                {/* Visual indicator if page num is known */}
                {chapter.start_page_num > 0 && (
                  <span className="text-[10px] text-gray-500 font-mono">Pg {chapter.start_page_num}</span>
                )}
              </div>
              <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{chapter.title}</h3>
            </button>
          ))}
        </div>
      )}
    </div>
  </div>
);

  // The Reader View
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

      <div className="max-w-3xl mx-auto w-full p-8 space-y-8">
        {paragraphs.length > 0 ? (
          paragraphs.map((para) => (
            <div key={para.id} className="group relative p-6 rounded-2xl border bg-[#1e0a3c]/50 border-transparent hover:border-white/10 transition-all">
              <p className="text-lg text-gray-200 leading-relaxed font-serif">{para.content}</p>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-20">
            <p>No content generated for this chapter yet.</p>
            {/* Phase 2: We will add a 'Generate This Chapter' button here later */}
            <p className="text-xs mt-2">Context-aware generation coming in Phase 2.</p>
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

      {/* RIGHT SIDEBAR (CHAT) - Kept exactly as it was */}
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