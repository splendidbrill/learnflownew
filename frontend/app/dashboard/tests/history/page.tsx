"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Trophy, Clock, ChevronRight, BookOpen } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface TestSession {
  id: string;
  created_at: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  book_id: string;
  chapter_id?: string;
  weak_concepts: string[];
}

interface BookInfo {
  id: string;
  title: string;
}

export default function TestHistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [tests, setTests] = useState<TestSession[]>([]);
  const [books, setBooks] = useState<Record<string, BookInfo>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestHistory();
  }, []);

  const fetchTestHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // Fetch test history
      const response = await fetch(`${API_URL}/tests/history/${user.id}?limit=20`);
      if (!response.ok) throw new Error("Failed to fetch test history");
      
      const testData = await response.json();
      setTests(testData);

      // Fetch book info for all unique book IDs
      const bookIds = [...new Set(testData.map((t: TestSession) => t.book_id))];
      const bookData: Record<string, BookInfo> = {};
      
      for (const bookId of bookIds) {
        const { data } = await supabase
          .from("books")
          .select("id, title")
          .eq("id", bookId)
          .single();
        if (data) bookData[bookId as string] = data;
      }
      
      setBooks(bookData);
    } catch (error) {
      console.error("Error fetching test history:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-400" />
            Test History
          </h1>
          <p className="text-gray-400">Review your past test performances</p>
        </div>

        {/* Tests List */}
        {tests.length === 0 ? (
          <div className="bg-gray-800/50 rounded-xl p-12 text-center">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No Tests Yet</h3>
            <p className="text-gray-400 mb-6">
              Complete at least 5 paragraphs and take your first test!
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <button
                key={test.id}
                onClick={() => router.push(`/dashboard/tests/${test.id}`)}
                className="w-full bg-gray-800/70 hover:bg-gray-800 border border-gray-700 hover:border-purple-500 rounded-xl p-6 transition-all group text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <BookOpen className="w-5 h-5 text-purple-400" />
                      <h3 className="text-lg font-bold text-white">
                        {books[test.book_id]?.title || "Unknown Book"}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-gray-400">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {formatDate(test.created_at)}
                      </div>
                      <div>
                        {test.correct_answers} / {test.total_questions} correct
                      </div>
                    </div>

                    {test.weak_concepts && test.weak_concepts.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-gray-500 mb-1">Struggled with:</p>
                        <div className="flex flex-wrap gap-2">
                          {test.weak_concepts.slice(0, 3).map((concept, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded"
                            >
                              {concept}
                            </span>
                          ))}
                          {test.weak_concepts.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{test.weak_concepts.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div
                        className={`text-3xl font-bold ${
                          test.score >= 90
                            ? "text-green-400"
                            : test.score >= 70
                            ? "text-yellow-400"
                            : "text-red-400"
                        }`}
                      >
                        {test.score}%
                      </div>
                      <div className="text-xs text-gray-500">Score</div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-gray-600 group-hover:text-purple-400 transition" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-8 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition"
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}
