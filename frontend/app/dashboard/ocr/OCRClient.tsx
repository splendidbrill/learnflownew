"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ScanLine,
  BookOpen,
  Upload,
  ChevronLeft,
  ChevronRight,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  BookMarked,
  ArrowLeft,
  List,
} from "lucide-react";
import Link from "next/link";
import { User } from "@supabase/supabase-js";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface OcrBook {
  id: number;
  title: string;
  filename: string;
  total_pages: number;
  status: "processing" | "completed" | "failed";
  created_at: string;
}

interface Chapter {
  id: number;
  chapter_number: number;
  chapter_title: string;
  content: string;
  page_start: number;
  page_end: number;
}

interface OcrBookDetail extends OcrBook {
  chapters: Chapter[];
}

type View = "upload" | "books" | "book-detail";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface OCRClientProps {
  user: User;
}

export const OCRClient: React.FC<OCRClientProps> = ({ user }) => {
  const [view, setView] = useState<View>("upload");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Books list state
  const [books, setBooks] = useState<OcrBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);

  // Book detail state
  const [selectedBook, setSelectedBook] = useState<OcrBookDetail | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [bookLoading, setBookLoading] = useState(false);

  // -------------------------------------------------------------------------
  // Load books when switching to books view
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (view === "books") loadBooks();
  }, [view]);

  const loadBooks = async () => {
    setBooksLoading(true);
    try {
      const res = await fetch(`${API}/ocr/books?user_id=${user.id}`);
      const data = await res.json();
      setBooks(Array.isArray(data) ? data : []);
    } catch {
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  };

  const openBook = async (bookId: number) => {
    setBookLoading(true);
    setView("book-detail");
    setSelectedChapter(null);
    try {
      const res = await fetch(`${API}/ocr/books/${bookId}?user_id=${user.id}`);
      const data = await res.json();
      setSelectedBook(data);
    } catch {
      setSelectedBook(null);
    } finally {
      setBookLoading(false);
    }
  };

  // -------------------------------------------------------------------------
  // Upload + polling
  // -------------------------------------------------------------------------
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.toLowerCase().endsWith(".pdf")) {
      setFile(dropped);
      setTitle(dropped.name.replace(/\.pdf$/i, ""));
      setUploadError("");
    } else {
      setUploadError("Only PDF files are supported.");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setTitle(selected.name.replace(/\.pdf$/i, ""));
      setUploadError("");
    }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setIsUploading(true);
    setProgress(2);
    setProgressLabel("Uploading PDF…");
    setUploadError("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("user_id", user.id);
      form.append("title", title);

      const res = await fetch(`${API}/ocr/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed.");
      }
      const { job_id } = await res.json();
      setProgressLabel("Processing pages…");
      startPolling(job_id);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
      setIsUploading(false);
      setProgress(0);
    }
  };

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/ocr/progress/${jobId}`);
        const data = await res.json();

        setProgress(data.percent ?? 0);

        if (data.total > 0) {
          setProgressLabel(`OCR page ${data.page} of ${data.total}…`);
        }

        if (data.status === "completed") {
          clearInterval(pollRef.current!);
          setProgress(100);
          setProgressLabel("Done! Opening your books…");
          setTimeout(() => {
            setIsUploading(false);
            setFile(null);
            setTitle("");
            setProgress(0);
            setProgressLabel("");
            setView("books");
          }, 1200);
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          setUploadError(data.error || "OCR processing failed.");
          setIsUploading(false);
          setProgress(0);
        }
      } catch {
        // keep polling on transient network errors
      }
    }, 2000);
  };

  useEffect(
    () => () => { if (pollRef.current) clearInterval(pollRef.current); },
    []
  );

  // -------------------------------------------------------------------------
  // Status helpers
  // -------------------------------------------------------------------------
  const statusIcon = (status: OcrBook["status"]) => {
    if (status === "completed") return <CheckCircle className="w-4 h-4 text-green-400" />;
    if (status === "failed") return <AlertCircle className="w-4 h-4 text-red-400" />;
    return <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />;
  };

  // -------------------------------------------------------------------------
  // View: Upload
  // -------------------------------------------------------------------------
  const UploadView = () => (
    <div className="max-w-xl mx-auto py-12 px-6">
      <h1 className="text-2xl font-bold text-white mb-1">Scan a Book</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Upload a PDF — GLM OCR will extract every page and build a structured, chapter-navigable book.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !file && !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 transition-all ${
          isUploading
            ? "cursor-default border-white/5"
            : isDragging
            ? "border-violet-400 bg-violet-500/10 cursor-copy"
            : file
            ? "border-violet-500/50 bg-violet-500/5 cursor-default"
            : "border-white/10 hover:border-white/20 hover:bg-white/2 cursor-pointer"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {file ? (
          <>
            <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <FileText className="w-7 h-7 text-violet-400" />
            </div>
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-gray-500 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            {!isUploading && (
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setTitle(""); }}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            )}
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center">
              <Upload className="w-7 h-7 text-gray-400" />
            </div>
            <p className="text-white font-medium">Drop your PDF here</p>
            <p className="text-gray-500 text-xs">or click to browse &mdash; PDF only</p>
          </>
        )}
      </div>

      {/* Title field */}
      {file && !isUploading && (
        <div className="mt-5">
          <label className="block text-xs text-gray-400 mb-1.5">Book title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter book title"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500/50 transition-colors"
          />
        </div>
      )}

      {/* Progress bar */}
      {isUploading && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">{progressLabel}</span>
            <span className="text-sm font-semibold text-violet-400">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-3 flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Large books may take several minutes to process.
          </p>
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <div className="mt-4 flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* Submit button */}
      {file && !isUploading && (
        <button
          onClick={handleSubmit}
          className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-semibold hover:opacity-90 active:opacity-80 transition-opacity"
        >
          Submit &amp; Start OCR
        </button>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // View: Books list
  // -------------------------------------------------------------------------
  const BooksView = () => (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">OCR Books</h1>
          <p className="text-gray-400 text-sm mt-0.5">All your scanned books</p>
        </div>
        <button
          onClick={loadBooks}
          className="text-xs text-gray-500 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {booksLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-20">
          <BookMarked className="w-12 h-12 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No OCR books yet.</p>
          <button
            onClick={() => setView("upload")}
            className="mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            Scan your first book &rarr;
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {books.map((book) => (
            <li key={book.id}>
              <button
                onClick={() => book.status === "completed" && openBook(book.id)}
                disabled={book.status !== "completed"}
                className={`w-full text-left flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all ${
                  book.status === "completed"
                    ? "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15]"
                    : "bg-white/[0.02] border-white/5 opacity-60 cursor-default"
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{book.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {book.total_pages > 0 ? `${book.total_pages} pages · ` : ""}
                    {new Date(book.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {statusIcon(book.status)}
                  <span
                    className={`text-xs capitalize ${
                      book.status === "completed"
                        ? "text-green-400"
                        : book.status === "failed"
                        ? "text-red-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {book.status}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // -------------------------------------------------------------------------
  // View: Book detail (TOC + chapter content)
  // -------------------------------------------------------------------------
  const BookDetailView = () => {
    if (bookLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        </div>
      );
    }
    if (!selectedBook) {
      return (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          Failed to load book.
        </div>
      );
    }

    return (
      <div className="flex flex-1 h-full overflow-hidden">
        {/* Chapter list sidebar */}
        <div className="w-64 shrink-0 border-r border-white/[0.08] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/5 shrink-0">
            <button
              onClick={() => { setView("books"); setSelectedBook(null); setSelectedChapter(null); }}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-3"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to books
            </button>
            <p className="text-white font-semibold text-sm leading-snug">{selectedBook.title}</p>
            <p className="text-gray-600 text-xs mt-0.5">{selectedBook.chapters.length} chapters</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            <p className="px-3 py-1.5 text-xs uppercase tracking-wider text-gray-600 font-bold flex items-center gap-1.5">
              <List className="w-3 h-3" /> Contents
            </p>
            {selectedBook.chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch)}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                  selectedChapter?.id === ch.id
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                    : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                }`}
              >
                <div className="flex items-start gap-1.5">
                  <span className="text-gray-600 text-xs shrink-0 mt-0.5">{ch.chapter_number}.</span>
                  <span className="leading-snug">{ch.chapter_title}</span>
                </div>
                {ch.page_start ? (
                  <span className="block text-xs text-gray-600 mt-0.5 pl-4">
                    p.{ch.page_start}–{ch.page_end}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-10 py-10">
          {!selectedChapter ? (
            /* TOC overview block */
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold text-white mb-1">{selectedBook.title}</h1>
              <p className="text-gray-500 text-sm mb-8">
                {selectedBook.total_pages} pages &middot; {selectedBook.chapters.length} chapters
              </p>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
                <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <List className="w-4 h-4 text-violet-400" />
                  Table of Contents
                </h2>
                <ol className="space-y-3">
                  {selectedBook.chapters.map((ch) => (
                    <li key={ch.id}>
                      <button
                        onClick={() => setSelectedChapter(ch)}
                        className="flex items-baseline gap-3 text-left w-full group"
                      >
                        <span className="text-gray-600 text-sm w-5 shrink-0 tabular-nums">
                          {ch.chapter_number}.
                        </span>
                        <span className="text-gray-300 group-hover:text-white transition-colors text-sm font-medium flex-1 leading-snug">
                          {ch.chapter_title}
                        </span>
                        {ch.page_start ? (
                          <span className="text-gray-600 text-xs shrink-0">p.{ch.page_start}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            /* Single chapter content */
            <div className="max-w-3xl">
              <button
                onClick={() => setSelectedChapter(null)}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors mb-6"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Table of Contents
              </button>
              <h2 className="text-2xl font-bold text-white mb-1">
                {selectedChapter.chapter_title}
              </h2>
              {selectedChapter.page_start ? (
                <p className="text-gray-600 text-xs mb-8">
                  Pages {selectedChapter.page_start}&ndash;{selectedChapter.page_end}
                </p>
              ) : null}
              <div className="space-y-4">
                {selectedChapter.content.split("\n\n").map((para, i) =>
                  para.trim() ? (
                    <p
                      key={i}
                      className="text-gray-300 leading-relaxed whitespace-pre-wrap text-sm"
                    >
                      {para}
                    </p>
                  ) : null
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Layout shell
  // -------------------------------------------------------------------------
  const navBtn = (target: View, icon: React.ReactNode, label: string, onClick?: () => void) => (
    <button
      onClick={() => { onClick?.(); setView(target); }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        view === target || (view === "book-detail" && target === "books")
          ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
          : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {!sidebarCollapsed && <span className="truncate">{label}</span>}
    </button>
  );

  return (
    <div className="flex h-screen bg-[#0a0514] text-white ml-20">
      {/* OCR section sidebar */}
      <div
        className={`h-full bg-[#0f0518] border-r border-white/[0.08] flex flex-col transition-all duration-300 shrink-0 ${
          sidebarCollapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <ScanLine className="w-4 h-4 text-violet-400" />
              </div>
              <span className="font-semibold text-sm">OCR Studio</span>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`text-gray-500 hover:text-white transition-colors ${sidebarCollapsed ? "mx-auto" : ""}`}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-1">
          {navBtn("upload", <ScanLine className="w-4 h-4" />, "OCR")}
          {navBtn("books", <BookOpen className="w-4 h-4" />, "OCR Books", loadBooks)}
        </nav>

        <div className="p-2 border-t border-white/5 shrink-0">
          <Link
            href="/dashboard"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-gray-600 hover:text-gray-400 hover:bg-white/[0.03] transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Dashboard</span>}
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {view === "upload" && (
          <div className="flex-1 overflow-y-auto">
            <UploadView />
          </div>
        )}
        {view === "books" && (
          <div className="flex-1 overflow-y-auto">
            <BooksView />
          </div>
        )}
        {view === "book-detail" && (
          <div className="flex-1 overflow-hidden flex">
            <BookDetailView />
          </div>
        )}
      </div>
    </div>
  );
};
