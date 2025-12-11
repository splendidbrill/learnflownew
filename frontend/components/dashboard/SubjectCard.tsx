
import React, { useState, useEffect, useRef } from 'react';
import { MoreHorizontal, BookOpen, Plus, Edit2, Trash2 } from 'lucide-react';
import { Subject, Book } from '../types';

interface SubjectCardProps {
  subject: Subject;
  onAddBook: (id: string) => void;
  onBookClick: (book: Book) => void;
  onEditSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: string) => void;
  onEditBook: (subjectId: string, book: Book) => void;
  onDeleteBook: (subjectId: string, bookId: string) => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({ 
  subject, 
  onAddBook, 
  onBookClick,
  onEditSubject,
  onDeleteSubject,
  onEditBook,
  onDeleteBook
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMenu(activeMenu === id ? null : id);
  };

  return (
    <div ref={cardRef} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 flex flex-col h-full hover:border-purple-500/30 transition-all relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]"
            style={{ backgroundColor: subject.color, boxShadow: `0 0 10px ${subject.color}` }}
          />
          <h3 className="font-bold text-lg text-white">{subject.name}</h3>
        </div>
        <div className="relative">
          <button 
            onClick={(e) => toggleMenu('subject-menu', e)}
            className={`text-gray-400 hover:text-white transition-colors p-1 rounded-md ${activeMenu === 'subject-menu' ? 'text-white bg-white/10' : ''}`}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          
          {activeMenu === 'subject-menu' && (
            <div className="absolute right-0 top-8 w-40 bg-[#1e1b2e] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="py-1">
                <button 
                  onClick={() => {
                    onEditSubject(subject);
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-white/5 hover:text-white transition-colors"
                >
                  Edit Subject
                </button>
                <button 
                  onClick={() => {
                    onDeleteSubject(subject.id);
                    setActiveMenu(null);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-white/5 transition-colors"
                >
                  Delete Subject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gray-300 text-sm">
          <BookOpen className="w-4 h-4" />
          <span>{subject.bookCount} Books</span>
        </div>
        {subject.isActive && (
          <span className="bg-white/10 text-gray-300 text-xs px-2 py-1 rounded-md font-medium">
            Active
          </span>
        )}
      </div>

      {/* Recent Books List */}
      <div className="flex-grow space-y-3 mb-6">
        {subject.recentBooks.length > 0 && (
          <div className="text-xs text-gray-400 font-medium mb-2">Recent Books</div>
        )}
        {subject.recentBooks.map((book) => (
          <div 
            key={book.id} 
            className="group relative flex items-center gap-2"
          >
            <button 
              onClick={() => onBookClick(book)}
              className="bg-white/5 rounded-lg p-2 flex items-center gap-3 flex-grow hover:bg-white/10 transition-colors text-left border border-transparent hover:border-white/5 pr-8"
            >
              <div className="w-2 h-3 rounded-sm shrink-0" style={{ backgroundColor: book.color }}></div>
              <span className="text-sm text-gray-300 truncate">{book.title}</span>
            </button>
            
            {/* Book Menu Trigger - Visible on Hover or Active */}
            <div className={`absolute right-1 ${activeMenu === book.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
               <div className="relative">
                <button 
                  onClick={(e) => toggleMenu(book.id, e)}
                  className={`p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/10 ${activeMenu === book.id ? 'bg-white/10 text-white' : ''}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                
                {activeMenu === book.id && (
                  <div className="absolute right-0 top-full mt-1 w-32 bg-[#1e1b2e] border border-white/10 rounded-lg shadow-xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <button 
                      onClick={() => {
                        onEditBook(subject.id, book);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                    <button 
                      onClick={() => {
                        onDeleteBook(subject.id, book.id);
                        setActiveMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                )}
               </div>
            </div>
          </div>
        ))}
        
        {subject.recentBooks.length === 0 && (
          <div className="h-12 flex items-center justify-center text-gray-500 text-xs italic">
            No books added yet
          </div> 
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Progress</span>
          <span>{subject.progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
            style={{ width: `${subject.progress}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-auto">
        <button 
          onClick={() => onAddBook(subject.id)}
          className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-lg shadow-purple-900/20"
        >
          <Plus className="w-4 h-4" />
          Add Book
        </button>
        <button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 py-2 px-4 rounded-lg text-sm font-medium transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
};
