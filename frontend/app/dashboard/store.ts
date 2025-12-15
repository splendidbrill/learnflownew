import { create } from 'zustand';
import { StoreState, Subject, Book } from './types';

export const useStore = create<StoreState>((set) => ({
  stats: { subjects: 0, totalBooks: 0, completed: 0, progress: 0 },
  subjects: [], 
  activeBook: null,
  
  setSubjects: (subjects) => set((state) => {
    const totalSubjects = subjects.length;
    const totalBooks = subjects.reduce((acc, sub) => acc + (sub.bookCount || 0), 0);
    return { subjects, stats: { ...state.stats, subjects: totalSubjects, totalBooks } };
  }),

  addSubject: (newSubject) => set((state) => ({
    subjects: [...state.subjects, newSubject],
    stats: { ...state.stats, subjects: state.stats.subjects + 1 }
  })),

  updateSubject: (id, data) => set((state) => ({
    subjects: state.subjects.map(sub => 
      sub.id === id ? { ...sub, ...data } as Subject : sub
    )
  })),

  deleteSubject: (id) => set((state) => {
    const subjectToDelete = state.subjects.find(s => s.id === id);
    return {
      subjects: state.subjects.filter(s => s.id !== id),
      stats: { ...state.stats, subjects: state.stats.subjects - 1, totalBooks: state.stats.totalBooks - (subjectToDelete?.bookCount || 0) }
    };
  }),

  addBook: (subjectId, book) => set((state) => ({
    subjects: state.subjects.map(sub => sub.id === subjectId ? { ...sub, bookCount: sub.bookCount + 1, recentBooks: [book, ...sub.recentBooks] } : sub),
    stats: { ...state.stats, totalBooks: state.stats.totalBooks + 1 }
  })),

  updateBook: (subjectId, bookId, data) => set((state) => ({
    subjects: state.subjects.map(sub => sub.id === subjectId ? { ...sub, recentBooks: sub.recentBooks.map(b => b.id === bookId ? { ...b, ...data } as Book : b) } : sub)
  })),

  deleteBook: (subjectId, bookId) => set((state) => ({
    subjects: state.subjects.map(sub => sub.id === subjectId ? { ...sub, bookCount: sub.bookCount - 1, recentBooks: sub.recentBooks.filter(b => b.id !== bookId) } : sub),
    stats: { ...state.stats, totalBooks: state.stats.totalBooks - 1 }
  })),

  setActiveBook: (book) => set({ activeBook: book })
}));