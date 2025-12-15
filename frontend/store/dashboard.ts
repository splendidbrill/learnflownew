import { create } from "zustand";
import type { StoreState, Subject, Book } from "@/types/dashboard";

export const useStore = create<StoreState>((set) => ({
  /* =========================
     STATE
  ========================= */
  stats: {
    subjects: 0,
    totalBooks: 0,
    completed: 0,
    progress: 0,
  },

  subjects: [],
  activeBook: null,

  /* =========================
     SUBJECT ACTIONS
  ========================= */
  setSubjects: (subjects) =>
    set(() => ({
      subjects,
      stats: {
        subjects: subjects.length,
        totalBooks: subjects.reduce(
          (sum, s) => sum + (s.recentBooks?.length ?? 0),
          0
        ),
        completed: 0,
        progress: 0,
      },
    })),

  addSubject: (subject) =>
    set((state) => ({
      subjects: [
        ...state.subjects,
        {
          ...subject,
          recentBooks: [],
          bookCount: 0,
        },
      ],
      stats: {
        ...state.stats,
        subjects: state.stats.subjects + 1,
      },
    })),

  updateSubject: (id, data) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.id === id ? { ...s, ...data } : s
      ),
    })),

  deleteSubject: (id) =>
    set((state) => {
      const subject = state.subjects.find((s) => s.id === id);
      const removedBooks = subject?.recentBooks?.length ?? 0;

      return {
        subjects: state.subjects.filter((s) => s.id !== id),
        stats: {
          ...state.stats,
          subjects: state.stats.subjects - 1,
          totalBooks: state.stats.totalBooks - removedBooks,
        },
      };
    }),

  /* =========================
     BOOK ACTIONS
  ========================= */
  addBook: (subjectId, book) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              recentBooks: [...(s.recentBooks ?? []), book],
              bookCount: (s.bookCount ?? 0) + 1,
            }
          : s
      ),
      stats: {
        ...state.stats,
        totalBooks: state.stats.totalBooks + 1,
      },
    })),

  updateBook: (subjectId, bookId, data) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              recentBooks: (s.recentBooks ?? []).map((b) =>
                b.id === bookId ? { ...b, ...data } : b
              ),
            }
          : s
      ),
    })),

  deleteBook: (subjectId, bookId) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.id === subjectId
          ? {
              ...s,
              recentBooks: (s.recentBooks ?? []).filter(
                (b) => b.id !== bookId
              ),
              bookCount: Math.max((s.bookCount ?? 1) - 1, 0),
            }
          : s
      ),
      stats: {
        ...state.stats,
        totalBooks: Math.max(state.stats.totalBooks - 1, 0),
      },
    })),

  /* =========================
     ACTIVE BOOK
  ========================= */
  setActiveBook: (book) => set(() => ({ activeBook: book })),
}));
