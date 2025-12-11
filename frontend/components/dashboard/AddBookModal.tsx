
// import React, { useState, useRef, useEffect } from 'react';
// import { X, Upload } from 'lucide-react';
// import { Book } from '../types';

// interface AddBookModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   subjectName: string;
//   onAdd: (data: { title: string; author: string; description: string; file: File | null }) => void;
//   initialData?: Book | null;
// }

// export const AddBookModal: React.FC<AddBookModalProps> = ({ isOpen, onClose, subjectName, onAdd, initialData }) => {
//   const [title, setTitle] = useState('');
//   const [author, setAuthor] = useState('');
//   const [description, setDescription] = useState('');
//   const [file, setFile] = useState<File | null>(null);
//   const fileInputRef = useRef<HTMLInputElement>(null);

//   // Reset state when modal opens
//   useEffect(() => {
//     if (isOpen) {
//       if (initialData) {
//         setTitle(initialData.title);
//         setAuthor(initialData.author || '');
//         setDescription(initialData.description || '');
//         setFile(initialData.file || null);
//       } else {
//         setTitle('');
//         setAuthor('');
//         setDescription('');
//         setFile(null);
//       }
//     }
//   }, [isOpen, initialData]);

//   // Prevent body scroll when modal is open
//   useEffect(() => {
//     if (isOpen) {
//       document.body.style.overflow = 'hidden';
//     } else {
//       document.body.style.overflow = 'unset';
//     }
//     return () => {
//       document.body.style.overflow = 'unset';
//     };
//   }, [isOpen]);

//   if (!isOpen) return null;

//   const handleSubmit = (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!title.trim()) return;
    
//     onAdd({
//       title,
//       author,
//       description,
//       file
//     });
//     onClose();
//   };

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       setFile(e.target.files[0]);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
//       {/* Backdrop */}
//       <div 
//         className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
//         onClick={onClose}
//         aria-hidden="true"
//       />

//       {/* Modal Panel Wrapper */}
//       <div className="flex min-h-full items-center justify-center p-4 text-center">
//         <div className="relative transform overflow-hidden rounded-xl bg-[#1e1b2e] border border-white/10 text-left shadow-2xl transition-all w-full max-w-md my-8 animate-in fade-in zoom-in duration-200">
          
//           {/* Header */}
//           <div className="flex justify-between items-start p-6 pb-2 border-b border-white/5">
//             <div>
//               <h2 className="text-xl font-semibold text-white">{initialData ? 'Edit Book' : `Add Book to ${subjectName}`}</h2>
//               <p className="text-gray-400 text-xs mt-1">
//                 {initialData ? 'Update book details.' : 'Add a book to this subject. PDF upload is optional.'}
//               </p>
//             </div>
//             <button 
//               onClick={onClose}
//               className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
//             >
//               <X className="w-5 h-5" />
//             </button>
//           </div>

//           <form onSubmit={handleSubmit} className="p-6 space-y-5">
//             {/* Book Title Input */}
//             <div className="space-y-1.5">
//               <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
//                 Book Title <span className="text-red-400">*</span>
//               </label>
//               <input
//                 type="text"
//                 value={title}
//                 onChange={(e) => setTitle(e.target.value)}
//                 placeholder="e.g., Organic Chemistry"
//                 className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
//                 required
//               />
//             </div>

//             {/* Author Name Input */}
//             <div className="space-y-1.5">
//               <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
//                 Author Name
//               </label>
//               <input
//                 type="text"
//                 value={author}
//                 onChange={(e) => setAuthor(e.target.value)}
//                 placeholder="e.g., Dr. John Smith"
//                 className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
//               />
//             </div>

//             {/* Description Input */}
//             <div className="space-y-1.5">
//               <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
//                 Description (Optional)
//               </label>
//               <textarea
//                 value={description}
//                 onChange={(e) => setDescription(e.target.value)}
//                 placeholder="Brief description of this book..."
//                 rows={3}
//                 className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
//               />
//             </div>

//             {/* PDF File Upload */}
//             <div className="space-y-1.5">
//               <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
//                 PDF File (Optional)
//               </label>
//               <div 
//                 className="border-2 border-dashed border-white/10 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer group"
//                 onClick={() => fileInputRef.current?.click()}
//               >
//                 <input 
//                   type="file" 
//                   ref={fileInputRef} 
//                   className="hidden" 
//                   accept=".pdf"
//                   onChange={handleFileChange}
//                 />
                
//                 {file ? (
//                   <div className="flex items-center gap-3 bg-purple-500/10 px-4 py-3 rounded-lg border border-purple-500/20">
//                     <div className="bg-purple-500/20 p-2 rounded">
//                       <Upload className="w-4 h-4 text-purple-300" />
//                     </div>
//                     <span className="text-sm font-medium text-purple-200 truncate max-w-[180px]">{file.name}</span>
//                     <button 
//                       type="button"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         setFile(null);
//                       }}
//                       className="text-gray-400 hover:text-red-400 p-1"
//                     >
//                       <X className="w-4 h-4" />
//                     </button>
//                   </div>
//                 ) : (
//                   <>
//                     <div className="bg-white/5 p-3 rounded-full mb-3 group-hover:bg-white/10 transition-colors">
//                       <Upload className="w-6 h-6 text-purple-300" />
//                     </div>
//                     <p className="text-gray-300 text-sm font-medium">Click to upload or drag and drop</p>
//                     <p className="text-gray-500 text-xs mt-1">PDF files only (optional)</p>
//                     <button 
//                       type="button"
//                       className="mt-4 bg-white/5 hover:bg-white/10 text-purple-200 text-xs font-medium px-4 py-2 rounded-md border border-white/10 transition-colors"
//                       onClick={(e) => {
//                         e.stopPropagation();
//                         fileInputRef.current?.click();
//                       }}
//                     >
//                       Select PDF
//                     </button>
//                   </>
//                 )}
//               </div>
//             </div>

//             {!initialData && (
//               <p className="text-[11px] text-gray-500 text-center pt-1">
//                 You can add the PDF file later. The book will be created with just the basic information.
//               </p>
//             )}

//             {/* Actions */}
//             <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
//               <button
//                 type="button"
//                 onClick={onClose}
//                 className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
//               >
//                 Cancel
//               </button>
//               <button
//                 type="submit"
//                 className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20"
//               >
//                 {initialData ? 'Save Changes' : 'Add Book'}
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// };

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Loader2, Sparkles, Check } from 'lucide-react';
import { Book } from '../types';
// FIX: Use relative paths instead of aliases to ensure build works
import { createClient } from '../../../lib/supabase/client'; 
import { ingestBook } from '../../../lib/n8n'; 
import { User } from '@supabase/supabase-js';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  subjectId: string;
  user: User;
  onAdd: (book: Book) => void;
  initialData?: Book | null;
}

const ANALOGY_OPTIONS = [
  { label: "General (No preference)", icon: "✨" },
  { label: "Football", icon: "⚽" },
  { label: "Cooking", icon: "🍳" },
  { label: "Video Games", icon: "🎮" },
  { label: "Driving / Cars", icon: "🏎️" },
  { label: "Shopping", icon: "🛍️" },
  { label: "Movies", icon: "🎬" },
  { label: "Music", icon: "🎵" },
  { label: "Traveling", icon: "✈️" }
];

export const AddBookModal: React.FC<AddBookModalProps> = ({ 
  isOpen, 
  onClose, 
  subjectName, 
  subjectId, 
  user, 
  onAdd, 
  initialData 
}) => {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [analogyTopic, setAnalogyTopic] = useState(ANALOGY_OPTIONS[0].label);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const supabase = createClient();

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        setAuthor(initialData.author || '');
        setDescription(initialData.description || '');
        // If we had this field in the Book type, we would load it here
        // setAnalogyTopic(initialData.analogyTopic || ANALOGY_OPTIONS[0].label);
        setFile(initialData.file || null);
      } else {
        setTitle('');
        setAuthor('');
        setDescription('');
        setAnalogyTopic(ANALOGY_OPTIONS[0].label);
        setFile(null);
      }
    }
  }, [isOpen, initialData]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setIsSubmitting(true);

    try {
      let fileUrl = null;

      // 1. Upload PDF to Supabase Storage
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('book-files')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('book-files')
          .getPublicUrl(fileName);
          
        fileUrl = urlData.publicUrl;
      }

      // 2. Insert Book Record into Database
      const newBookData = {
        user_id: user.id,
        subject_id: subjectId,
        title,
        author,
        description,
        file_url: fileUrl,
        analogy_topic: analogyTopic, // Save the selected interest
        ...(initialData && !file ? { file_url: (initialData as any).fileUrl } : {}) 
      };

      let savedBook;

      if (initialData) {
        const { data, error } = await supabase
          .from('books')
          .update(newBookData)
          .eq('id', initialData.id)
          .select()
          .single();
        if (error) throw error;
        savedBook = data;
      } else {
        const { data, error } = await supabase
          .from('books')
          .insert([newBookData])
          .select()
          .single();
        if (error) throw error;
        savedBook = data;
      }

      // 3. Create Progress Entry (Start at 0)
      if (savedBook && !initialData) {
         await supabase.from('user_progress').insert({
           user_id: user.id,
           book_id: savedBook.id,
           current_chunk_index: 1
         });
      }

      // 4. Trigger n8n AI Ingestion
      if (fileUrl && savedBook) {
        console.log("Triggering AI Ingestion...");
        ingestBook(savedBook.id, fileUrl, user.id); 
      }

      onAdd({
        id: savedBook.id,
        title: savedBook.title,
        author: savedBook.author,
        description: savedBook.description,
        color: '#fbbf24',
        file: file,
        // @ts-ignore
        fileUrl: savedBook.file_url
      });

      onClose();
    } catch (error) {
      console.error("Error saving book:", error);
      alert("Failed to save book. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="relative transform overflow-hidden rounded-xl bg-[#1e1b2e] border border-white/10 text-left shadow-2xl transition-all w-full max-w-md my-8 animate-in fade-in zoom-in duration-200">
          
          <div className="flex justify-between items-start p-6 pb-2 border-b border-white/5">
            <div>
              <h2 className="text-xl font-semibold text-white">{initialData ? 'Edit Book' : `Add Book to ${subjectName}`}</h2>
              <p className="text-gray-400 text-xs mt-1">
                {initialData ? 'Update book details.' : 'Add a book to this subject. PDF upload is optional.'}
              </p>
            </div>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            
            {/* Title */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                Book Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Organic Chemistry"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                required
              />
            </div>

            {/* Author */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                Author Name
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g., Dr. John Smith"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>

            {/* Interest / Analogy Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" /> 
                Personalize My Learning
              </label>
              
              <p className="text-[11px] text-gray-400 italic">
                I will customize your lessons using analogies from <strong>{analogyTopic}</strong>.
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                {ANALOGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setAnalogyTopic(opt.label)}
                    className={`relative text-xs px-3 py-2.5 rounded-lg border transition-all text-left flex items-center gap-2 ${
                      analogyTopic === opt.label 
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="truncate font-medium">{opt.label}</span>
                    {analogyTopic === opt.label && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Check className="w-3 h-3 text-purple-400" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this book..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
              />
            </div>

            {/* PDF File */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
                PDF File (Optional)
              </label>
              <div 
                className="border-2 border-dashed border-white/10 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".pdf"
                  onChange={handleFileChange}
                />
                
                {file ? (
                  <div className="flex items-center gap-3 bg-purple-500/10 px-3 py-2 rounded-lg border border-purple-500/20 w-full">
                    <div className="bg-purple-500/20 p-1.5 rounded">
                      <Upload className="w-3.5 h-3.5 text-purple-300" />
                    </div>
                    <span className="text-xs font-medium text-purple-200 truncate flex-1 text-left">{file.name}</span>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-gray-400 hover:text-red-400 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400 group-hover:text-gray-300 transition-colors">
                    <Upload className="w-4 h-4" />
                    <span className="text-xs">Upload PDF</span>
                  </div>
                )}
              </div>
            </div>

            {!initialData && (
              <p className="text-[10px] text-gray-500 text-center pt-1">
                The AI will analyze your PDF to create chapters automatically.
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-lg shadow-purple-900/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {initialData ? 'Save Changes' : 'Add Book'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};