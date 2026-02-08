"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Clock, BookOpen, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface Question {
  question_text: string;
  question_type: "mcq" | "true_false" | "short_answer";
  options: string[];
}

export default function TestPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const generateTest = async () => {
    setGenerating(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("Please log in to take a test");
        return;
      }

      const response = await fetch(`${API_URL}/api/tests/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          book_id: bookId,
          user_id: user.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to generate test");
      }

      const data = await response.json();
      setQuestions(data.questions);
      setSessionId(data.session_id);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    generateTest();
  }, [bookId]);

  const handleAnswer = (answer: string) => {
    setAnswers({ ...answers, [currentQuestion]: answer });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    try {
      const formattedAnswers = questions.map((_, idx) => ({
        question_id: `q${idx}`,
        answer: answers[idx] || "",
      }));

      const response = await fetch(`${API_URL}/api/tests/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          answers: formattedAnswers,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit test");

      const results = await response.json();
      router.push(`/dashboard/test/${sessionId}/results?score=${results.score}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading || generating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-purple-500 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">
            {generating ? "Generating Your Test..." : "Loading..."}
          </h2>
          <p className="text-gray-400">
            AI is creating personalized questions based on your progress
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-6">
        <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white text-center mb-2">Error</h2>
          <p className="text-gray-300 text-center">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-6 w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py3 px-6 rounded-lg transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BookOpen className="w-6 h-6 text-purple-500" />
            <div>
              <h1 className="text-xl font-bold text-white">Test in Progress</h1>
              <p className="text-sm text-gray-400">
                Question {currentQuestion + 1} of {questions.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <Clock className="w-5 h-5" />
            <span className="font-mono">{formatTime(timeElapsed)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-gray-800/70 backdrop-blur rounded-2xl p-8 mb-6 border border-gray-700">
          <div className="mb-6">
            <span className="text-sm text-purple-400 font-medium">
              {currentQ.question_type === "mcq" && "Multiple Choice"}
              {currentQ.question_type === "true_false" && "True or False"}
              {currentQ.question_type === "short_answer" && "Short Answer"}
            </span>
            <h2 className="text-2xl font-bold text-white mt-2">
              {currentQ.question_text}
            </h2>
          </div>

          {/* Answer Options */}
          <div className="space-y-3">
            {currentQ.question_type === "short_answer" ? (
              <textarea
                value={answers[currentQuestion] || ""}
                onChange={(e) => handleAnswer(e.target.value)}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg p-4 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition"
                rows={4}
                placeholder="Type your answer here..."
              />
            ) : (
              currentQ.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    answers[currentQuestion] === option
                      ? "border-purple-500 bg-purple-500/20 text-white"
                      : "border-gray-600 bg-gray-900/30 text-gray-300 hover:border-purple-400"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        answers[currentQuestion] === option
                          ? "border-purple-500 bg-purple-500"
                          : "border-gray-500"
                      }`}
                    >
                      {answers[currentQuestion] === option && (
                        <div className="w-3 h-3 bg-white rounded-full" />
                      )}
                    </div>
                    <span className="font-medium">{option}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {currentQuestion === questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(answers).length < questions.length}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Test"
              )}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition"
            >
              Next
            </button>
          )}
        </div>

        {/* Answer Counter */}
        <div className="mt-6 text-center text-sm text-gray-400">
          Answered: {Object.keys(answers).length} / {questions.length}
        </div>
      </div>
    </div>
  );
}
