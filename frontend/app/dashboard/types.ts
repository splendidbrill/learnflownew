export interface Book {
  id: string;
  title: string;
  author?: string;
  description?: string;
  color: string;
  fileUrl?: string | null;
  file?: File | null;
  coverUrl?: string;
  analogy_topic?: string; // New: Stores the "Domain + Analogy" string
}

export interface Subject {
  id: string;
  user_id: string;          // <--- Changed to Required (not optional)
  created_at?: string;
  name: string;
  description?: string;
  color: string;
  bookCount: number;
  recentBooks: Book[];
  isActive?: boolean;
  progress?: number;
}

// Old Stats interface removed (merged with the one below)

export interface StoreState {
  stats: Stats;
  subjects: Subject[];
  activeBook: Book | null;

  setSubjects: (subjects: Subject[]) => void;
  addSubject: (data: Subject) => void; // Expects a FULL subject now
  updateSubject: (id: string, data: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  
  addBook: (subjectId: string, book: Book) => void;
  updateBook: (subjectId: string, bookId: string, data: Partial<Book>) => void;
  deleteBook: (subjectId: string, bookId: string) => void;
  
  setActiveBook: (book: Book | null) => void;
}

export interface Stats {
  subjects: number;
  totalBooks: number;
  completed: number;
  progress: number;
  // New Gamification Fields
  xp: number;
  streak: number;
  level: number;
  rank: string;
}