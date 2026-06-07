import React, { useState, useEffect } from 'react';
import { X, Upload, Book, AlertCircle } from 'lucide-react';
import { Book as BookType } from '../types'; // Adjust path to your types

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  subjectId: string;
  user: any;
  onAdd: (book: BookType) => void;
  initialData?: BookType | null;
}

export const AddBookModal: React.FC<AddBookModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  subjectId,
  user,
  onAdd,
  initialData
}) => {
  // --- STATE DEFINITIONS ---
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  // const [description, setDescription] = useState(''); // REMOVED
  const [domain, setDomain] = useState('');
  const [isNcert, setIsNcert] = useState(false);
  const [analogyTopic, setAnalogyTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [isLoading, setIsLoading] = useState(false); 
  const [progress, setProgress] = useState(0); // <--- NEW: Upload Progress

  useEffect(() => {
    if (isOpen && initialData) {
      setTitle(initialData.title);
      setAuthor(initialData.author || '');
      setDomain(''); // Default empty or try to parse?
      setAnalogyTopic(initialData.analogy_topic || '');
    } else if (isOpen) {
      // Reset form on open
      setTitle('');
      setAuthor('');
      setDomain('');
      setIsNcert(false);
      setAnalogyTopic('');
      setFile(null);
      setProgress(0);
    }
  }, [isOpen, initialData]);

  // --- UPLOAD FILE VIA BACKEND API WITH PROGRESS ---
  const uploadFileWithProgress = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('user_id', user.id);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_URL}/upload-pdf`);

      // Progress Event
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const result = JSON.parse(xhr.responseText);
            resolve(result.file_url);
          } catch {
            reject(new Error('Invalid response from upload API'));
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network Error"));
      xhr.send(formData);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !initialData) {
      alert("Please select a file");
      return;
    }
    if (!domain) {
      alert("Please select a Book Domain (e.g. Science, Math)");
      return;
    }

    setIsLoading(true);
    setProgress(0); // Reset

    try {
      let fileUrl = initialData?.fileUrl;

      // 1. Upload File via backend API (if new file selected)
      if (file) {
        fileUrl = await uploadFileWithProgress(file);
      }

      // DO NOT COMBINE: Domain + Analogy (User requested separation)
      const finalAnalogyTopic = analogyTopic.trim();

      const bookData = {
        title,
        author,
        description: isNcert ? `NCERT ${domain}` : domain,
        subject_id: subjectId,
        user_id: user.id,
        file_url: fileUrl,
        analogy_topic: finalAnalogyTopic
      };

      let resultBook;

      // 2. Insert/Update via backend API
      if (initialData) {
        const res = await fetch(`${API_URL}/books/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to update book');
        }
        resultBook = await res.json();
      } else {
        const res = await fetch(`${API_URL}/books`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bookData)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to create book');
        }
        resultBook = await res.json();
      }

      // 3. Update UI
      const newBook: BookType = {
        id: resultBook.id,
        title: resultBook.title,
        author: resultBook.author,
        description: resultBook.description,
        color: '#fbbf24',
        fileUrl: resultBook.file_url,
        analogy_topic: resultBook.analogy_topic
      };

      onAdd(newBook);
      onClose();

    } catch (error: any) {
      console.error('Error saving book:', error);
      alert(`Failed to save book: ${error.message}`);
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#1e0a3c] rounded-2xl w-full max-w-2xl border border-purple-500/20 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
          <div>
            <h2 className="text-xl font-bold text-white">
              {initialData ? 'Edit Book' : 'Add New Book'}
            </h2>
            <p className="text-purple-300 text-sm mt-1">
              Adding to <span className="font-semibold text-white">{subjectName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="space-y-4">
            {/* File Upload */}
            <div className={`border-2 border-dashed ${file ? 'border-purple-500 bg-purple-500/20' : 'border-purple-500/30'} rounded-xl p-6 text-center hover:bg-purple-500/10 transition-colors`}>
              <input 
                type="file" 
                id="book-file" 
                className="hidden" 
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.epub"
              />
              <label htmlFor="book-file" className="cursor-pointer flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-white font-medium">
                  {file ? file.name : (initialData?.fileUrl ? 'Change File' : 'Upload Book (PDF/EPUB)')}
                </span>
                <span className="text-sm text-gray-400">Click to browse your files</span>
              </label>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Book Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. Introduction to Physics"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Author</label>
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g. Stephen Hawking"
                />
              </div>
            </div>

            {/* DOMAIN SELECTION (Replaces Description) */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-300">Book Domain <span className="text-red-400">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {['Science', 'Math', 'Computer Science', 'History', 'Geography', 'Political Science', 'Literature', 'Self Help', 'Others'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDomain(d)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                      domain === d 
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40 transform scale-105' 
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              {!domain && <p className="text-xs text-red-400/80 mt-1">Please select a domain to enable smart features.</p>}
            </div>

            {/* NCERT TOGGLE */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsNcert(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${isNcert ? 'bg-purple-600' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isNcert ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-gray-300">NCERT book <span className="text-gray-500 text-xs">(uses higher-quality diagram settings)</span></span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                Teaching Analogy (Optional)
                <div className="group relative">
                  <AlertCircle className="w-4 h-4 text-purple-400 cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 bg-gray-900 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none">
                    AI will explain concepts using this analogy (e.g., 'Football', 'Cooking')
                  </div>
                </div>
              </label>
              <input
                type="text"
                value={analogyTopic}
                onChange={(e) => setAnalogyTopic(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                placeholder="e.g. Rocket League, Soccer, Cooking"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-white/10">
            
            {/* --- PROGRESS BAR --- */}
            {isLoading && progress > 0 && progress < 100 && (
              <div className="w-full space-y-2">
                <div className="flex justify-between text-xs text-purple-300">
                  <span>Uploading to Cloud Storage...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                     {progress >= 100 ? (
                        <>
                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           <span>Finishing up...</span>
                        </>
                     ) : (
                        <span>Uploading ({progress}%)</span>
                     )}
                  </>
                ) : (
                  <>
                    <Book className="w-4 h-4" />
                    {initialData ? 'Update Book' : 'Add Book'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};