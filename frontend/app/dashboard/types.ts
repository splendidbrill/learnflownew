export interface Book {
  id: string;
  title: string;
  author?: string;
  description?: string;
  color: string;
  fileUrl?: string | null;
  file?: File | null;
  coverUrl?: string;
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

export interface Stats {
  subjects: number;
  totalBooks: number;
  completed: number;
  progress: number;
}

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