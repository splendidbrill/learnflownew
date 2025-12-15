/* =========================
   SUBJECT (matches DB)
========================= */
export interface Subject {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;

  /* UI-only (derived) */
  bookCount?: number;
  recentBooks?: Book[];
}

/* =========================
   BOOK (matches DB)
========================= */
export interface Book {
  id: string;
  subject_id: string;
  user_id: string;
  title: string;
  author: string | null;
  file_url: string | null;
  total_pages: number;
  created_at: string;
}

/* =========================
   DASHBOARD STATS
========================= */
export interface DashboardStats {
  subjects: number;
  totalBooks: number;
  completed: number;
  progress: number;
}

/* =========================
   ZUSTAND STORE SHAPE
========================= */
export interface StoreState {
  stats: DashboardStats;
  subjects: Subject[];
  activeBook: Book | null;

  setSubjects: (subjects: Subject[]) => void;

  addSubject: (subject: Subject) => void;
  updateSubject: (
    id: string,
    data: { name: string; color: string | null; description: string | null }
  ) => void;
  deleteSubject: (id: string) => void;

  addBook: (subjectId: string, book: Book) => void;
  updateBook: (
    subjectId: string,
    bookId: string,
    data: Partial<Book>
  ) => void;
  deleteBook: (subjectId: string, bookId: string) => void;

  setActiveBook: (book: Book | null) => void;
}
