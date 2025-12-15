import React, { useState, useEffect } from 'react';
import { X, Upload, Book, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client'; // Adjust path if needed
import { Book as BookType } from '../types'; // Adjust path to your types

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
  const supabase = createClient();
  
  // --- STATE DEFINITIONS ---
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [analogyTopic, setAnalogyTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  // This was missing before:
  const [isLoading, setIsLoading] = useState(false); 

  useEffect(() => {
    if (isOpen && initialData) {
      setTitle(initialData.title);
      setAuthor(initialData.author || '');
      setDescription(initialData.description || '');
      // If you have analogy_topic in your Book type, map it here too
    } else if (isOpen) {
      // Reset form on open
      setTitle('');
      setAuthor('');
      setDescription('');
      setAnalogyTopic('');
      setFile(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !initialData) {
      alert("Please select a file");
      return;
    }

    setIsLoading(true); // Now this will work
    try {
      let fileUrl = initialData?.fileUrl;

      // 1. Upload File (if new file selected)
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('books')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('books')
          .getPublicUrl(fileName);
          
        fileUrl = urlData.publicUrl;
      }

      const bookData = {
        title,
        author,
        description,
        subject_id: subjectId, // Links to the Course ID
        user_id: user.id,
        file_url: fileUrl,
        analogy_topic: analogyTopic 
      };

      let resultBook;

      // 2. Insert/Update in 'course_books'
      if (initialData) {
        const { data, error } = await supabase
          .from('course_books')
          .update(bookData)
          .eq('id', initialData.id)
          .select()
          .single();
        if (error) throw error;
        resultBook = data;
      } else {
        const { data, error } = await supabase
          .from('course_books')
          .insert([bookData])
          .select()
          .single();
        if (error) throw error;
        resultBook = data;
      }

      // 3. Update UI
      const newBook: BookType = {
        id: resultBook.id,
        title: resultBook.title,
        author: resultBook.author,
        description: resultBook.description,
        color: '#fbbf24', 
        fileUrl: resultBook.file_url,
      };

      onAdd(newBook);
      onClose();

    } catch (error: any) {
      console.error('Error saving book:', error);
      alert(`Failed to save book: ${error.message}`);
    } finally {
      setIsLoading(false);
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
            <div className="border-2 border-dashed border-purple-500/30 rounded-xl p-6 text-center hover:bg-purple-500/10 transition-colors">
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                placeholder="Brief summary or notes..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                Analogy Topic
                <div className="group relative">
                  <AlertCircle className="w-4 h-4 text-purple-400 cursor-help" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-1 bg-gray-900 text-xs text-white rounded opacity-0 group-hover:opacity-100 transition-opacity w-48 text-center pointer-events-none">
                    AI will use this topic to explain concepts (e.g., 'Football', 'Cooking')
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

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
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
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Book className="w-4 h-4" />
                  {initialData ? 'Update Book' : 'Add Book'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};