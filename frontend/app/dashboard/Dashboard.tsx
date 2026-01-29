"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Book as BookIcon, 
  BookOpen, 
  CheckCircle, 
  BarChart2, 
  Plus, 
  Clock, 
  Library, 
  TrendingUp,
  Zap,
  Flame,
  AlertTriangle
} from 'lucide-react';

import { useStore } from './store';
import { StatCard } from './components/StatCard';
import { SubjectCard } from './components/SubjectCard';
import { QuickActionCard } from './components/QuickActionCard';
import { AddSubjectModal } from './components/AddSubjectModal';
import { AddBookModal } from './components/AddBookModal';
import { ConfirmationModal } from './components/ConfirmationModal';

// Import Types
import { Subject, Book } from './types'; 
import { Sidebar } from './Sidebar'; 
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface DashboardProps {
  user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const supabase = createClient();
  const router = useRouter();
  
  const { 
    stats, 
    subjects, 
    addSubject, 
    updateSubject, 
    deleteSubject, 
    addBook, 
    updateBook, 
    deleteBook, 
    setSubjects 
  } = useStore();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [statsData, setStatsData] = useState({ xp: 0, streak: 0, rank: 'Novice', level: 1 });
  
  // Modal State for Books
  const [bookModalState, setBookModalState] = useState<{ 
    isOpen: boolean; 
    subjectId: string | null; 
    editBook?: Book | null 
  }>({
    isOpen: false,
    subjectId: null,
    editBook: null
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ 
    isOpen: boolean; 
    type: 'subject' | 'book' | null; 
    id: string | null; 
    subjectId?: string; 
    name: string;
  }>({
    isOpen: false,
    type: null,
    id: null,
    name: ''
  });

  const [userMetrics, setUserMetrics] = useState({ 
  xp: 0, 
  streak: 0, 
  totalBooks: 0, 
  totalSubjects: 0 
});

useEffect(() => {
  const fetchGlobalStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Fetch GLOBAL XP from Profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('xp')
      .eq('id', user.id)
      .single();

    // 2. Fetch Counts
    const { count: books } = await supabase.from('course_books').select('*', { count: 'exact', head: true });
    const { count: subjects } = await supabase.from('subjects').select('*', { count: 'exact', head: true });

    setUserMetrics({
      xp: profile?.xp || 0,
      streak: 0, // Placeholder for now
      totalBooks: books || 0,
      totalSubjects: subjects || 0
    });
  };

  fetchGlobalStats();
}, []);

 // ... inside Dashboard component ...

 useEffect(() => {
    const fetchAllData = async () => {
      if (!user) return;

      try {
        // 1. Fetch Subjects & Books
        const { data: coursesData, error } = await supabase
          .from('courses')
          .select(`*, course_books(*)`)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // 2. Fetch Gamification Stats
        const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/${user.id}`);
        const statsData = await statsRes.json();

        // 3. FETCH BOOK PROGRESS (NEW SQL FUNCTION)
        const { data: progressData, error: progressError } = await supabase
          .rpc('get_user_book_progress', { target_user_id: user.id });

          

        if (progressError) console.error("Progress fetch error:", progressError);

        // Create a lookup map: { 'book_uuid': 55 } (55% done)
        const progressMap: Record<string, number> = {};
        if (progressData) {
            progressData.forEach((p: any) => {
                if (p.total_paragraphs > 0) {
                    progressMap[p.book_id] = Math.round((p.completed_paragraphs / p.total_paragraphs) * 100);
                } else {
                    progressMap[p.book_id] = 0;
                }
            });
        }

        // 4. Process Data & Merge Progress
        let totalBooks = 0;
        const formattedSubjects: Subject[] = (coursesData || []).map((s: any) => {
          const books = s.course_books || [];
          totalBooks += books.length;
           let sumOfBookPercentages = 0;
          
          // Calculate Subject Progress (Average of its books)
          let subjectTotalProgress = 0;

          const processedBooks = books.map((b: any) => {
            // const bookProgress = progressMap[b.id] || 0;
            // subjectTotalProgress += bookProgress;

            const stats = progressData?.find((p: any) => p.book_id === b.id);
            const total = stats?.total_paragraphs || 0;
            const completed = stats?.completed_paragraphs || 0;

            // Calculate Book Percentage
            const bookPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            sumOfBookPercentages += bookPercent;
            
            return {
              id: b.id,
              title: b.title,
              author: b.author,
              description: b.description,
              color: s.color,
              fileUrl: b.file_url,
              analogy_topic: b.analogy_topic,
              progress: bookPercent  // <--- Assign Real Progress Here
            };
          });
           const subjectProgress = books.length > 0 
            ? Math.round(sumOfBookPercentages / books.length) 
            : 0;

          return {
            id: s.id,
            user_id: s.user_id,
            name: s.name,
            color: s.color,
            description: s.description,
            created_at: s.created_at,
            bookCount: books.length,
            recentBooks: processedBooks,
            isActive: false,
            // Calculate average for the subject card itself
            progress: subjectProgress,
          };
        });

        // 5. Update Store
        useStore.setState({ 
          subjects: formattedSubjects,
          stats: {
            subjects: formattedSubjects.length,
            totalBooks: totalBooks,
            completed: 0, 
            progress: 0,
            xp: statsData.xp || 0,
            streak: statsData.streak || 0,
            level: statsData.level || 1,
            rank: statsData.rank || "Novice"
          }
        });

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [user, supabase]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase
          .from('courses')
          .select(`*, course_books(*)`) // <--- CHANGE 1: Fetch from new table
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (data) {
          const formattedSubjects: Subject[] = data.map((s: any) => ({
            id: s.id,
            user_id: s.user_id,
            name: s.name,
            color: s.color,
            description: s.description,
            created_at: s.created_at,
            // CHANGE 2: Map 'course_books' to 'bookCount'
            bookCount: s.course_books ? s.course_books.length : 0,
            // CHANGE 3: Map 'course_books' to 'recentBooks'
            recentBooks: s.course_books ? s.course_books.map((b: any) => ({
              id: b.id,
              title: b.title,
              author: b.author,
              description: b.description,
              color: s.color,
              fileUrl: b.file_url,
              analogy_topic: b.analogy_topic // Ensure this is captured
            })) : [],
            isActive: false,
            progress: 0
          }));
          setSubjects(formattedSubjects);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }

    // Inside Dashboard.tsx useEffect

    const fetchStats = async () => {
      try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/${user.id}`);
          const data = await res.json();
          
          // Update your Zustand store or local state with real data
          useStore.setState(prev => ({
              stats: {
                  ...prev.stats,
                  xp: data.xp, // You might need to add 'xp' to your store types
                  streak: data.streak,
                  rank: data.rank
              }
          }));
      } catch (e) {
          console.error("Failed to load stats", e);
      }
  };
  
  if (user) {
      const initDashboard = async () => {
        // 1. CHECK-IN STREAK (Update DB)
        try {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/checkin/${user.id}`, { method: 'POST' });
        } catch (err) {
          console.error("Check-in failed", err);
        }

        // 2. FETCH LATEST STATS (Read DB)
        await fetchStats();
        await fetchData();
      };
      
      initDashboard();
  }
  }, [user, supabase, setSubjects]);

  // --- Handlers ---

  const handleBookClick = (book: Book) => {
    console.log("Navigating to book:", book.id);
    // router.push(`/dashboard/book/${book.id}`);
    router.push(`/dashboard/book/${book.id}`);
  };

  const handleAddSubject = async (data: { name: string; color: string; description: string }) => {
    console.log("Attempting to save subject:", data);

    // 1. EDIT MODE
    if (editingSubject) {
      const { error } = await supabase
      .from('courses')
        .update({ 
          name: data.name, 
          color: data.color, 
          description: data.description 
        })
        .eq('id', editingSubject.id);
        
      if (error) {
        console.error("Error updating subject:", error);
        alert(`Failed to update subject: ${error.message}`);
        return; 
      }

      // Safe update using Partial<Subject>
      updateSubject(editingSubject.id, data);
      setEditingSubject(null);
      setIsSubjectModalOpen(false);
    } 
    // 2. CREATE MODE
    else {
      // NOTE: If this fails with "cache" errors, change 'subjects' to 'learning_subjects'
      const { data: newSubject, error } = await supabase
        .from('courses')
        .insert([{ 
            name: data.name, 
            description: data.description,
            color: data.color, 
            user_id: user.id 
        }])
        .select()
        .single();
        
      if (error) {
        console.error("Error creating subject:", error);
        alert(`Failed to create subject: ${error.message} (Check console for details)`);
        return; 
      }

      if (newSubject) {
        // Construct the full Subject object for the store
        const subjectToAdd: Subject = {
            id: newSubject.id,
            user_id: user.id,
            created_at: newSubject.created_at,
            name: data.name,
            description: data.description,
            color: data.color,
            bookCount: 0,
            recentBooks: [],
            isActive: false,
            progress: 0
        };
        addSubject(subjectToAdd); 
        setIsSubjectModalOpen(false); 
      }
    }
  };

  const handleBookSaved = (book: Book) => {
    const { subjectId, editBook } = bookModalState;
    if (!subjectId) return;
    
    if (editBook) {
      updateBook(subjectId, book.id, book);
    } else {
      addBook(subjectId, book);
    }
    setBookModalState({ isOpen: false, subjectId: null, editBook: null });
  };

  const handleEditSubject = (subject: Subject) => {
    setEditingSubject(subject);
    setIsSubjectModalOpen(true);
  };

  const handleDeleteSubjectRequest = (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (subject) {
      setDeleteConfirm({
        isOpen: true,
        type: 'subject',
        id,
        name: subject.name
      });
    }
  };

  const handleAddBookClick = (subjectId: string) => {
    setBookModalState({ isOpen: true, subjectId, editBook: null });
  };

  const handleEditBook = (subjectId: string, book: Book) => {
    setBookModalState({ isOpen: true, subjectId, editBook: book });
  };

  const handleDeleteBookRequest = (subjectId: string, bookId: string) => {
    const subject = subjects.find(s => s.id === subjectId);
    const book = subject?.recentBooks.find(b => b.id === bookId);
    if (book) {
      setDeleteConfirm({
        isOpen: true,
        type: 'book',
        id: bookId,
        subjectId,
        name: book.title
      });
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteConfirm.type === 'subject' && deleteConfirm.id) {
        // 1. Send Delete Request to Database
        const { error } = await supabase
          .from('courses') // Make sure this matches your DB table name
          .delete()
          .eq('id', deleteConfirm.id);
        
        if (error) {
           console.error("Database Delete Failed:", error);
           throw error; // This jumps to the catch block
        }

        // 2. Only update UI if Database succeeded
        deleteSubject(deleteConfirm.id);
      } 
      else if (deleteConfirm.type === 'book' && deleteConfirm.id && deleteConfirm.subjectId) {
        // First, delete all related study_sessions to avoid foreign key constraint violation
        const { error: sessionsError } = await supabase
          .from('study_sessions')
          .delete()
          .eq('book_id', deleteConfirm.id);
        
        if (sessionsError) {
          console.error("Failed to delete study sessions:", sessionsError);
          throw sessionsError;
        }

        // Then delete the book itself
        const { error } = await supabase
          .from('course_books')
          .delete()
          .eq('id', deleteConfirm.id);
          
        if (error) throw error;
        
        deleteBook(deleteConfirm.subjectId, deleteConfirm.id);
      }
    } catch (error: any) {
      // 3. Show the actual error to you
      alert(`Cannot delete: ${error.message || "Database permission denied"}`);
      console.error(error);
    } finally {
      setDeleteConfirm({ ...deleteConfirm, isOpen: false });
    }
  };

  const addingBookSubjectName = subjects.find(s => s.id === bookModalState.subjectId)?.name || '';

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#13002b] items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-purple-200">Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#13002b] overflow-hidden">
      <Sidebar user={user} />

      <div className="flex-1 ml-20 overflow-y-auto h-full bg-gradient-to-br from-[#13002b] via-[#1e0a3c] to-[#0f0518] p-6 md:p-10 text-white selection:bg-purple-500/30">
        <div className="max-w-7xl mx-auto space-y-10 pb-10">
          <header className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold mb-1 text-white">
                Welcome back, {user.user_metadata?.full_name || 'Scholar'}!
              </h1>
              <p className="text-purple-300/80 text-sm md:text-base">Pick up where you left off</p>
            </div>
          </header>

          {/* Stats Section */}
          {/* Stats Section */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. XP CARD */}
            <StatCard 
              title="Total XP" 
              value={stats.xp || userMetrics.xp || 0} 
              icon={Zap} 
              subtext={`Lvl ${stats.level || 1} - ${stats.rank || 'Novice'}`} 
            />
            
            {/* 2. STREAK CARD */}
            <StatCard 
              title="Day Streak" 
              value={stats.streak || 0} 
              icon={Flame} 
            />
            
            {/* 3. EXISTING TOTAL BOOKS */}
            <StatCard 
              title="Total Books" 
              value={userMetrics.totalBooks} 
              icon={BookIcon} 
            />

            {/* 4. EXISTING SUBJECTS */}
            <StatCard 
              title="Subjects" 
              value={stats.subjects} 
              icon={BookOpen} 
            />
          </section>

          {/* Subjects Section */}
          <section>
            {subjects.length === 0 ? (
              <>
                <h2 className="text-2xl font-semibold mb-6">My Subjects</h2>
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 group-hover:bg-white/10 transition-colors">
                    <BookOpen className="w-10 h-10 text-purple-400 opacity-50" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">You have no subjects</h3>
                  <p className="text-gray-400 max-w-sm mb-8">
                    Create your first subject to start organizing your books and learning materials.
                  </p>
                  <button 
                    onClick={() => {
                      setEditingSubject(null);
                      setIsSubjectModalOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all hover:scale-105 shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                  >
                    <Plus className="w-5 h-5" />
                    Create First Subject
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-2xl font-semibold">My Subjects</h2>
                  <button 
                    onClick={() => {
                      setEditingSubject(null);
                      setIsSubjectModalOpen(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all active:scale-95 shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                  >
                    <Plus className="w-4 h-4" />
                    Add Subject
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {subjects.map((subject) => (
                    <SubjectCard 
                      key={subject.id} 
                      subject={subject} 
                      onAddBook={handleAddBookClick}
                      onBookClick={handleBookClick}
                      onEditSubject={handleEditSubject}
                      onDeleteSubject={handleDeleteSubjectRequest}
                      onEditBook={handleEditBook}
                      onDeleteBook={handleDeleteBookRequest}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-2xl font-semibold mb-6">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <QuickActionCard title="Schedule Lesson" description="Set up automated learning sessions" icon={Clock} />
              <QuickActionCard title="Browse Library" description="Access all your learning materials" icon={Library} />
              <QuickActionCard title="View Progress" description="Track your learning journey" icon={TrendingUp} />
            </div>
          </section>

          <AddSubjectModal 
            isOpen={isSubjectModalOpen}
            onClose={() => setIsSubjectModalOpen(false)}
            onAdd={handleAddSubject}
            initialData={editingSubject}
          />

          <AddBookModal
            isOpen={bookModalState.isOpen}
            onClose={() => setBookModalState({ ...bookModalState, isOpen: false })}
            subjectName={addingBookSubjectName}
            subjectId={bookModalState.subjectId || ''}
            user={user}
            onAdd={handleBookSaved}
            initialData={bookModalState.editBook}
          />

          <ConfirmationModal 
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
            onConfirm={handleConfirmDelete}
            title={`Delete ${deleteConfirm.type === 'subject' ? 'Subject' : 'Book'}?`}
            message={`Are you sure you want to delete "${deleteConfirm.name}"? This action cannot be undone.`}
          />
        </div>
      </div>
    </div>
  );
}