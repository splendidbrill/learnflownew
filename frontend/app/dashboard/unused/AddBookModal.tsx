"use client";

import React, { useState } from "react";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadBookToBackend } from "@/lib/api";
import { useStore } from "@/store/dashboard";
import type { Book } from "@/types/dashboard";

/* =========================
   PROPS
========================= */
interface AddBookModalProps {
  open: boolean;
  onClose: () => void;
  subjectId: string;
}

/* =========================
   COMPONENT
========================= */
const AddBookModal: React.FC<AddBookModalProps> = ({
  open,
  onClose,
  subjectId,
}) => {
  const supabase = createClient();
  const addBook = useStore((s) => s.addBook);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  /* =========================
     UPLOAD HANDLER
  ========================= */
  const handleUpload = async () => {
    if (!title.trim()) {
      alert("Book title is required");
      return;
    }
    if (!file) {
      alert("Please select a PDF file");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Not authenticated");
        return;
      }

      const result = await uploadBookToBackend({
        file,
        title: title.trim(),
        subjectId,
        userId: user.id,
        author: author.trim() || undefined,
      });

      const book: Book = {
        id: result.book_id,
        subject_id: subjectId,
        user_id: user.id,
        title: title.trim(),
        author: author.trim() || null,
        file_url: result.file_url ?? null,
        total_pages: result.total_pages ?? 0,
        created_at: new Date().toISOString(),
      };

      addBook(subjectId, book);

      setTitle("");
      setAuthor("");
      setFile(null);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to upload book");
    } finally {
      setLoading(false);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e1b2e] border border-white/10 rounded-xl w-full max-w-md p-6 text-white relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-xl font-semibold mb-6">Add Book</h2>

        {/* Title */}
        <label className="text-sm text-gray-400">Title *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mt-1 mb-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-purple-500 outline-none"
          placeholder="e.g. Physics Vol. 1"
        />

        {/* Author */}
        <label className="text-sm text-gray-400">Author (optional)</label>
        <input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="w-full mt-1 mb-4 px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-purple-500 outline-none"
          placeholder="e.g. Halliday"
        />

        {/* File */}
        <label className="text-sm text-gray-400">PDF File *</label>
        <label className="mt-2 flex flex-col items-center justify-center border border-dashed border-gray-600 hover:border-purple-500 rounded-xl p-6 cursor-pointer">
          <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
          <span className="text-sm text-gray-400">
            {file ? file.name : "Select PDF"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        {/* Submit */}
        <button
          onClick={handleUpload}
          disabled={loading}
          className="mt-6 w-full bg-purple-600 hover:bg-purple-500 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5" />
              Upload Book
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AddBookModal;
