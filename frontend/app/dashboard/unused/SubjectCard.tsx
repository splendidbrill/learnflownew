"use client";

import React from "react";
import { Plus, BookOpen, Trash2, Pencil } from "lucide-react";
import type { Subject, Book } from "@/types/dashboard";

export interface SubjectCardProps {
  subject: Subject;

  // REQUIRED (used by Dashboard)
  onAddBook: (subjectId: string) => void;
  onBookClick: (book: Book) => void;

  // OPTIONAL (future-proof, avoids TS errors)
  onEditSubject?: (subject: Subject) => void;
  onDeleteSubject?: (subjectId: string) => void;
  onEditBook?: (subjectId: string, book: Book) => void;
  onDeleteBook?: (subjectId: string, bookId: string) => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  subject,
  onAddBook,
  onBookClick,
  onEditSubject,
  onDeleteSubject,
  onEditBook,
  onDeleteBook,
}) => {
  const books = subject.recentBooks ?? [];

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-white flex flex-col gap-4">
      {/* ---------- HEADER ---------- */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: subject.color ?? "#a855f7" }}
          />
          <div>
            <h3 className="font-semibold text-lg leading-tight">
              {subject.name}
            </h3>
            {subject.description && (
              <p className="text-xs text-gray-400 line-clamp-2">
                {subject.description}
              </p>
            )}
          </div>
        </div>

        {/* Optional Subject Actions */}
        {(onEditSubject || onDeleteSubject) && (
          <div className="flex gap-2">
            {onEditSubject && (
              <button
                onClick={() => onEditSubject(subject)}
                className="p-1 text-gray-400 hover:text-white"
                title="Edit subject"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {onDeleteSubject && (
              <button
                onClick={() => onDeleteSubject(subject.id)}
                className="p-1 text-red-400 hover:text-red-300"
                title="Delete subject"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ---------- BOOK LIST ---------- */}
      <div className="flex flex-col gap-2">
        {books.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            No books yet.
          </p>
        ) : (
          books.map((book) => (
            <div
              key={book.id}
              className="flex items-center justify-between gap-3 bg-black/20 border border-white/10 rounded-lg px-3 py-2 hover:bg-black/30 transition cursor-pointer"
              onClick={() => onBookClick(book)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {book.title}
                  </p>
                  {book.author && (
                    <p className="text-xs text-gray-400 truncate">
                      {book.author}
                    </p>
                  )}
                </div>
              </div>

              {/* Optional Book Actions */}
              {(onEditBook || onDeleteBook) && (
                <div className="flex gap-2 shrink-0">
                  {onEditBook && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditBook(subject.id, book);
                      }}
                      className="p-1 text-gray-400 hover:text-white"
                      title="Edit book"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {onDeleteBook && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteBook(subject.id, book.id);
                      }}
                      className="p-1 text-red-400 hover:text-red-300"
                      title="Delete book"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ---------- ADD BOOK ---------- */}
      <button
        onClick={() => onAddBook(subject.id)}
        className="mt-2 flex items-center justify-center gap-2 text-sm text-purple-300 hover:text-white border border-purple-600/30 hover:border-purple-500 rounded-lg py-2 transition"
      >
        <Plus className="w-4 h-4" />
        Add Book
      </button>
    </div>
  );
};

export default SubjectCard;
