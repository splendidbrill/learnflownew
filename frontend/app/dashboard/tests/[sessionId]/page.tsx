"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle, XCircle, Trophy, Clock, BookOpen } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  correct_answer: string;
  options?: string[];
  concept: string;
  user_answer?: string;
}

interface TestSession {
  id: string;
  created_at: string;
  score: number;
  correct_answers: number;
  total_questions: number;
  book_id: string;
  weak_concepts: string[];
}

export default function TestDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<TestSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [bookTitle, setBookTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestDetails();
  }, [sessionId]);

  const fetchTestDetails = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tests/session/${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch test details");

      const data = await response.json();
      setSession(data.session);
      setQuestions(data.questions);

      // Fetch book title
      const { data: bookData } = await supabase
        .from("books")
        .select("title")
        .eq("id", data.session.book_id)
        .single();
      
      if (bookData) setBookTitle(bookData.title);
    } catch (error) {
      console.error("Error fetching test details:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Test Not Found</h2>
          <button
            onClick={() => router.push("/dashboard/tests/history")}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
          >
            Back to Test History
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header with Score */}
        <div className="bg-gray-800/70 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="w-6 h-6 text-purple-400" />
                <h1 className="text-2xl font-bold text-white">{bookTitle}</h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {new Date(session.created_at).toLocaleDateString()}
                </div>
                <div>
                  {session.correct_answers} / {session.total_questions} correct
                </div>
              </div>
            </div>
            <div className="text-center">
              <div
                className={`text-5xl font-bold ${
                  session.score >= 90
                    ? "text-green-400"
                    : session.score >= 70
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {session.score}%
              </div>
              <div className="text-sm text-gray-500 mt-1">Final Score</div>
            </div>
          </div>

          {/* Weak Concepts */}
          {session.weak_concepts && session.weak_concepts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400 mb-2">Areas to review:</p>
              <div className="flex flex-wrap gap-2">
                {session.weak_concepts.map((concept, idx) => (
                  <span
                    key={idx}
                    className="text-sm bg-red-500/20 text-red-300 px-3 py-1 rounded-full"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Questions Review */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Questions & Answers</h2>
          
          {questions.map((q, idx) => {
            const isCorrect = q.user_answer === q.correct_answer;
            
            return (
              <div
                key={q.id}
                className={`bg-gray-800/70 rounded-xl p-6 border-2 ${
                  isCorrect ? "border-green-500/30" : "border-red-500/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  {isCorrect ? (
                    <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-bold text-gray-400">Q{idx + 1}</span>
                      <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                        {q.concept}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-medium text-white mb-4">{q.question_text}</h3>
                    
                    {/* Options */}
                    {q.options && (
                      <div className="space-y-2 mb-4">
                        {q.options.map((option, optIdx) => (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-lg border-2 ${
                              option === q.correct_answer
                                ? "border-green-500 bg-green-500/10"
                                : option === q.user_answer && !isCorrect
                                ? "border-red-500 bg-red-500/10"
                                : "border-gray-700 bg-gray-900/30"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {option === q.correct_answer && (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              )}
                              {option === q.user_answer && !isCorrect && (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                              <span className="text-gray-200">{option}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* User Answer for Short Answer Questions */}
                    {!q.options && (
                      <div className="space-y-2">
                        <div className="bg-red-500/10 border-2 border-red-500 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">Your Answer:</p>
                          <p className="text-gray-200">{q.user_answer || "No answer provided"}</p>
                        </div>
                        <div className="bg-green-500/10 border-2 border-green-500 rounded-lg p-3">
                          <p className="text-xs text-gray-400 mb-1">Correct Answer:</p>
                          <p className="text-gray-200">{q.correct_answer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Back Button */}
        <button
          onClick={() => router.push("/dashboard/tests/history")}
          className="mt-8 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition"
        >
          ← Back to Test History
        </button>
      </div>
    </div>
  );
}
