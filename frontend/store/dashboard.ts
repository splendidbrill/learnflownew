import { create } from 'zustand';
import { StoreState, Subject, Book } from '../types/dashboard';

const BOOK_COLORS = ['#fbbf24', '#4ade80', '#f87171', '#60a5fa', '#c084fc', '#fb7185'];

export const useStore = create<StoreState>((set) => ({
  stats: {
    subjects: 0,
    totalBooks: 0,
    completed: 0,
    progress: 0,
  },
  subjects: [], // Start empty, wait for DB fetch
  activeBook: null,
  
  // --- NEW ACTION: Set all subjects from DB ---
  setSubjects: (subjects) => set((state) => {
    // Recalculate stats based on the fetched data
    const totalSubjects = subjects.length;
    const totalBooks = subjects.reduce((acc, sub) => acc + (sub.bookCount || 0), 0);

    return {
      subjects,
      stats: {
        ...state.stats,
        subjects: totalSubjects,
        totalBooks: totalBooks
      }
    };
  }),

  addSubject: (newSubjectData) => set((state) => {
    // FIX: Use the ID provided by DB, or fallback to random if not provided
    const id = (newSubjectData as any).id || Math.random().toString(36).substring(2, 9);

    const newSubject: Subject = {
      id: id,
      name: newSubjectData.name,
      description: newSubjectData.description,
      color: newSubjectData.color,
      bookCount: 0,
      isActive: true,
      progress: 0,
      recentBooks: []
    };

    return {
      subjects: [...state.subjects, newSubject],
      stats: {
        ...state.stats,
        subjects: state.stats.subjects + 1
      }
    };
  }),

  updateSubject: (id, data) => set((state) => ({
    subjects: state.subjects.map(sub => 
      sub.id === id 
        ? { ...sub, name: data.name, color: data.color, description: data.description }
        : sub
    )
  })),

  deleteSubject: (id) => set((state) => {
    const subjectToDelete = state.subjects.find(s => s.id === id);
    const bookCount = subjectToDelete ? subjectToDelete.bookCount : 0;

    return {
      subjects: state.subjects.filter(s => s.id !== id),
      stats: {
        ...state.stats,
        subjects: state.stats.subjects - 1,
        totalBooks: state.stats.totalBooks - bookCount
      }
    };
  }),

  addBook: (subjectId, bookDetails) => set((state) => {
    const randomColor = BOOK_COLORS[Math.floor(Math.random() * BOOK_COLORS.length)];
    
    // FIX: Use the ID provided by DB
    const id = (bookDetails as any).id || Math.random().toString(36).substring(2, 9);

    const newBook: Book = {
      id: id,
      title: bookDetails.title,
      author: bookDetails.author,
      description: bookDetails.description,
      color: randomColor,
      file: bookDetails.file,
      // @ts-ignore - You should add fileUrl to your Book type
      fileUrl: (bookDetails as any).fileUrl 
    };

    const updatedSubjects = state.subjects.map(sub => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          bookCount: sub.bookCount + 1,
          recentBooks: [newBook, ...sub.recentBooks]
        };
      }
      return sub;
    });

    return {
      subjects: updatedSubjects,
      stats: {
        ...state.stats,
        totalBooks: state.stats.totalBooks + 1
      }
    };
  }),

  updateBook: (subjectId, bookId, data) => set((state) => ({
    subjects: state.subjects.map(sub => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          recentBooks: sub.recentBooks.map(book => 
            book.id === bookId 
              ? { ...book, title: data.title, author: data.author, description: data.description }
              : book
          )
        };
      }
      return sub;
    })
  })),

  deleteBook: (subjectId, bookId) => set((state) => {
    const updatedSubjects = state.subjects.map(sub => {
      if (sub.id === subjectId) {
        return {
          ...sub,
          bookCount: sub.bookCount - 1,
          recentBooks: sub.recentBooks.filter(b => b.id !== bookId)
        };
      }
      return sub;
    });

    return {
      subjects: updatedSubjects,
      stats: {
        ...state.stats,
        totalBooks: state.stats.totalBooks - 1
      }
    };
  }),

  setActiveBook: (book) => set({ activeBook: book })
}));