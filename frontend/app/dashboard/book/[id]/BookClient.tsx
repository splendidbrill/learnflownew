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

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Menu, 
  X, 
  Send, 
  MessageSquare, 
  BookOpen, 
  CheckCircle,
  MoreVertical,
  ChevronRight,
  LogOut // Icon for back button
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface BookClientProps {
  bookId: string;
}

interface Chapter {
  id: string;
  title: string;
  order_index: number;
  progress?: number;
}

interface Paragraph {
  id: string;
  content: string;
  is_completed: boolean;
}

export const BookClient: React.FC<BookClientProps> = ({ bookId }) => {
  const router = useRouter();
  const supabase = createClient();

  // --- State ---
  const [book, setBook] = useState<any | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [chatMessage, setChatMessage] = useState("");

  // --- Fetch Data ---
  useEffect(() => {
    const init = async () => {
      // 1. Fetch Book Info
      const { data: bookData } = await supabase
        .from('course_books')
        .select('*')
        .eq('id', bookId)
        .single();
      setBook(bookData);

      // 2. Fetch Chapters
      const { data: chapterData } = await supabase
        .from('chapters')
        .select('*')
        .eq('book_id', bookId)
        .order('order_index', { ascending: true });
      
      if (chapterData) {
        setChapters(chapterData.map(c => ({
          ...c,
          progress: Math.floor(Math.random() * 100) // Mock progress
        })));
      }
      
      setIsLoading(false);
    };

    if (bookId) init();
  }, [bookId]);

  // --- Fetch Paragraphs ---
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


  // --- Debug Functions (Now with Alerts) ---
  const createDummyData = async () => {
    if (!bookId) return;
    console.log("Creating dummy chapters for book:", bookId);
    
    const dummies = [
      { book_id: bookId, title: "The Power of Thought", order_index: 0 },
      { book_id: bookId, title: "Desire: The Turning Point", order_index: 1 },
      { book_id: bookId, title: "Faith and Visualization", order_index: 2 },
    ];
    
    const { error } = await supabase.from('chapters').insert(dummies);
    
    if (error) {
      alert(`Error creating chapters: ${error.message}`);
      console.error(error);
    } else {
      alert("Chapters created! Reloading...");
      window.location.reload();
    }
  };

  const createDummyParagraphs = async () => {
    if (!selectedChapter) return;
    
    const dummies = [
      { chapter_id: selectedChapter.id, content: "Truly, 'thoughts are things,' and powerful things at that, when they are mixed with definiteness of purpose, persistence, and a burning desire for their translation into riches, or other material objects.", order_index: 0 },
      { chapter_id: selectedChapter.id, content: "A little over thirty years ago, Edwin C. Barnes discovered how true it is that men really do think and grow rich. His discovery did not come about at one sitting.", order_index: 1 },
      { chapter_id: selectedChapter.id, content: "It came little by little, beginning with a burning desire to become a business associate of the great Edison.", order_index: 2 },
    ];
    
    const { error } = await supabase.from('paragraphs').insert(dummies);
    
    if (error) {
       alert(`Error creating paragraphs: ${error.message}`);
    } else {
       // Refresh paragraphs locally without full reload
       const { data } = await supabase.from('paragraphs').select('*').eq('chapter_id', selectedChapter.id);
       setParagraphs(data || []);
    }
  };

  // --- Renders ---
  
  const renderChapterGrid = () => (
    <div className="p-10 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
      <div className="text-center mb-12">
        <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-400">
          <BookOpen className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{book?.title || 'Loading...'}</h1>
        <p className="text-gray-400">Select a chapter to start reading</p>
      </div>

      {chapters.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-white/10 rounded-xl bg-white/5">
          <p className="text-gray-400 mb-4">No chapters found.</p>
          <button 
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
            onClick={createDummyData} 
          >
            (Debug) Generate Dummy Chapters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => setSelectedChapter(chapter)}
              className="group text-left bg-[#1e0a3c] hover:bg-[#2a1352] border border-white/5 hover:border-purple-500/50 p-6 rounded-xl transition-all hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                  CH {chapter.order_index + 1}
                </span>
                {chapter.progress === 100 && <CheckCircle className="w-4 h-4 text-green-500" />}
              </div>
              <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{chapter.title}</h3>
              <div className="w-full bg-black/40 h-1.5 rounded-full mt-4 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-purple-600 to-blue-600" 
                  style={{ width: `${chapter.progress}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderReader = () => (
    <div className="flex flex-col h-full bg-[#0f0518] overflow-y-auto scrollbar-thin scrollbar-thumb-purple-900/50">
      <div className="sticky top-0 bg-[#0f0518]/95 backdrop-blur z-10 border-b border-white/5 p-4 flex items-center gap-4">
         <button 
           onClick={() => setSelectedChapter(null)}
           className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
         >
           <ArrowLeft className="w-5 h-5" />
         </button>
         <div>
           <h2 className="text-white font-semibold">{selectedChapter?.title}</h2>
           <p className="text-xs text-gray-400">Reading Mode</p>
         </div>
      </div>

      <div className="max-w-3xl mx-auto w-full p-8 space-y-8">
        {paragraphs.length > 0 ? (
          paragraphs.map((para) => (
            <div 
              key={para.id} 
              className={`group relative p-6 rounded-2xl border transition-all duration-300 ${para.is_completed ? 'bg-purple-900/10 border-purple-500/20' : 'bg-[#1e0a3c]/50 border-transparent hover:border-white/10'}`}
            >
              <p className="text-lg text-gray-200 leading-relaxed font-serif">{para.content}</p>
              <div className="absolute -right-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 bg-[#2a1352] text-purple-300 rounded-full hover:bg-purple-600 hover:text-white">
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-20">
            <p>No content here.</p>
            <button className="text-purple-400 text-sm mt-2 hover:underline" onClick={createDummyParagraphs}>
              (Debug) Generate Content
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (isLoading) return <div className="bg-[#13002b] h-screen text-white flex items-center justify-center">Loading...</div>;

  return (
    <div className="flex h-screen bg-[#13002b] overflow-hidden">
      
      {/* 1. LEFT SIDEBAR */}
      <div className={`flex-shrink-0 bg-[#0a0212] border-r border-white/5 transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-white font-semibold">Table of Contents</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Chapters List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => setSelectedChapter(chapter)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg text-sm text-left transition-colors ${selectedChapter?.id === chapter.id ? 'bg-purple-600/20 text-purple-300 border border-purple-500/20' : 'text-gray-400 hover:bg-white/5'}`}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded bg-white/5 flex items-center justify-center text-xs font-mono">{chapter.order_index + 1}</span>
              <span className="truncate">{chapter.title}</span>
            </button>
          ))}
        </div>

        {/* --- BACK TO DASHBOARD BUTTON (Bottom) --- */}
        <div className="p-4 border-t border-white/10 mt-auto">
          <button 
            onClick={() => router.push('/dashboard')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl transition-all border border-white/5 group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        </div>
      </div>

      {/* 2. MIDDLE SECTION */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#13002b] relative">
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 bg-[#1e0a3c] border border-white/10 p-2 rounded-lg text-white shadow-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
          >
            <Menu className="w-4 h-4" />
            <span className="text-xs font-medium">Chapters</span>
          </button>
        )}
        <div className="flex-1 overflow-hidden relative">
          {selectedChapter ? renderReader() : renderChapterGrid()}
        </div>
      </div>

      {/* 3. RIGHT SIDEBAR (Chat) */}
      <div className="w-[400px] flex-shrink-0 bg-[#0f0518] border-l border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5 bg-[#1e0a3c]/30">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            AI Tutor
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
             <MessageSquare className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-white font-medium mb-2">Start a conversation</h3>
          <p className="text-sm text-gray-500">Ask questions about this chapter.</p>
        </div>
        <div className="p-4 border-t border-white/5 bg-[#0a0212]">
          <div className="relative">
            <input 
              type="text" 
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Ask about this chapter..."
              className="w-full bg-[#1e0a3c] border border-white/10 text-white rounded-xl py-3 px-4 pr-12 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-500 transition-colors">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};