"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trophy, TrendingDown, TrendingUp, BarChart3, BookOpen, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ConceptScore {
  correct: number;
  total: number;
}

interface TestResults {
  score: number;
  correct: number;
  total: number;
  concept_breakdown: Record<string, ConceptScore>;
  weak_concepts: string[];
  recommendations: string;
}

export default function TestResultsPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  
  const [results, setResults] = useState<TestResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResults();
  }, [sessionId]);

  useEffect(() => {
    if (results && results.score >= 80) {
      // Celebrate with confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [results]);

  const fetchResults = async () => {
    try {
      const response = await fetch(`${API_URL}/api/tests/session/${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch results");
      
      const data = await response.json();
      setResults(data.session);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading results...</div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Results not found</div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreGrade = (score: number) => {
    if (score >= 90) return "A+";
    if (score >= 80) return "A";
    if (score >= 70) return "B";
    if (score >= 60) return "C";
    return "D";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Score Card */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 mb-6 border border-purple-500/30 text-center">
          <Trophy className={`w-20 h-20 mx-auto mb-4 ${getScoreColor(results.score)}`} />
          <h1 className="text-5xl font-bold text-white mb-2">
            {Math.round(results.score)}%
          </h1>
          <div className={`text-3xl font-bold mb-4 ${getScoreColor(results.score)}`}>
            Grade: {getScoreGrade(results.score)}
          </div>
          <p className="text-gray-400">
            {results.correct} out of {results.total} questions correct
          </p>
          
          {results.score >= 90 && (
            <div className="mt-4 text-green-400 font-medium">
              🎉 Outstanding! You've mastered this material!
            </div>
          )}
          {results.score >= 70 && results.score < 90 && (
            <div className="mt-4 text-yellow-400 font-medium">
              👍 Great job! Just a bit more practice needed.
            </div>
          )}
          {results.score < 70 && (
            <div className="mt-4 text-orange-400 font-medium">
              💪 Keep practicing! Review your weak areas below.
            </div>
          )}
        </div>

        {/* Concept Breakdown */}
        {results.concept_breakdown && Object.keys(results.concept_breakdown).length > 0 && (
          <div className="bg-gray-800/70 backdrop-blur rounded-2xl p-6 mb-6 border border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-6 h-6 text-purple-500" />
              <h2 className="text-xl font-bold text-white">Performance by Concept</h2>
            </div>
            
            <div className="space-y-4">
              {Object.entries(results.concept_breakdown).map(([concept, score]) => {
                const accuracy = (score.correct / score.total) * 100;
                const isWeak = accuracy < 60;
                
                return (
                  <div key={concept} className="bg-gray-900/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isWeak ? (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        ) : (
                          <TrendingUp className="w-5 h-5 text-green-500" />
                        )}
                        <span className="text-white font-medium capitalize">
                          {concept.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className={`font-bold ${isWeak ? "text-red-400" : "text-green-400"}`}>
                        {score.correct}/{score.total}
                      </span>
                    </div>
                    
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isWeak ? "bg-red-500" : "bg-green-500"
                        }`}
                        style={{ width: `${accuracy}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weak Concepts & Recommendations */}
        {results.weak_concepts && results.weak_concepts.length > 0 && (
          <div className="bg-orange-900/30 border border-orange-500/50 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-6 h-6 text-orange-500" />
              <h2 className="text-xl font-bold text-white">Areas to Review</h2>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-300">{results.recommendations}</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {results.weak_concepts.map((concept) => (
                <span
                  key={concept}
                  className="px-4 py-2 bg-orange-500/20 border border-orange-500/30 rounded-full text-orange-300 text-sm font-medium"
                >
                  {concept.replace(/_/g, " ")}
                </span>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-orange-500/30">
              <p className="text-sm text-gray-400 mb-3">
                These concepts have been added to your review queue for spaced repetition.
              </p>
              <button
                onClick={() => router.push("/dashboard/reviews")}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition"
              >
                <span>Review Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition"
          >
            Take Another Test
          </button>
        </div>
      </div>
    </div>
  );
}
