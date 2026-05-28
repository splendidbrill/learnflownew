"use client";

import React, { useEffect, useState, useRef } from "react";
import { Suspense } from "react";

import { useRouter, useSearchParams } from "next/navigation"; // <--- Add useSearchParams (Force Update)
import {
  Menu,
  X,
  Send,
  MessageSquare,
  BookOpen,
  LogOut,
  Loader2,
  ChevronRight,
  AlertCircle,
  Trophy,
  Flame,
  PieChart,
  Clock,
  FileText, Volume2, Play, Pause, Globe,
} from "lucide-react";
import rehypeRaw from 'rehype-raw';
import { createClient } from "@/lib/supabase/client";
import { ScheduleModal } from "../../components/ScheduleModal"; // Ensure this path is correct
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

// --- TYPES ---

interface BookClientProps {
  bookId: string;
}

interface Chapter {
  id: string;
  title: string;
  order_index: number;
  start_page_num: number;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageUrl?: string;
}

interface Paragraph {
  id: string;
  content: string;
  is_completed: boolean;
  order_index: number;
  section_title?: string;
  type?: "text" | "image" | "code" | "header";
  explanation?: string;
  latex_content?: string; // NEW: LaTeX code extracted from math equations
  contains_math?: boolean; // NEW: Flags math equations
}

interface Book {
  id: string;
  title: string;
  file_url: string;
  analogy_topic: string; // Dynamic Interest
  status: "pending" | "processing" | "completed" | "failed";
}

export const BookClient: React.FC<BookClientProps> = (props) => {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-[#13002b] text-white flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <BookClientContent {...props} />
    </Suspense>
  );
};

export const BookClientContent: React.FC<BookClientProps> = ({ bookId }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(
    null,
  );



  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [selectedLanguage, setSelectedLanguage] = useState("english"); // Add a dropdown somewhere
  const [audioLanguage, setAudioLanguage] = useState("english"); // Default
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);


  const [bookXp, setBookXp] = useState(0);
  const [bookLevelXp, setBookLevelXp] = useState(0);
  const [showLatexForPara, setShowLatexForPara] = useState<Record<string, boolean>>({});

  // Stats State
  const [userXp, setUserXp] = useState(0);
  const [bookProgress, setBookProgress] = useState(0);
  const [chapterProgress, setChapterProgress] = useState(0);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [bookStatus, setBookStatus] = useState<string>("pending");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chapterGenProgress, setChapterGenProgress] = useState(0);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Schedule & User
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<"create" | "edit">("create");
  const [user, setUser] = useState<any>(null);
  const [analyzingParaId, setAnalyzingParaId] = useState<string | null>(null);
  // ... existing state ...
  // Resizable Sidebar State
  const [chatWidth, setChatWidth] = useState(400); // Default width
  const [isResizing, setIsResizing] = useState(false);




  // NEW: Tracks which message is currently loaded in the audio player
  const [currentAudioMessageId, setCurrentAudioMessageId] = useState<string | null>(null);

  // NEW: Tracks which messages have received feedback
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'got_it' | 'confused' | null>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- INITIALIZATION ---

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    fetchStats();
  }, []);

  const fetchStats = async (currentUserId?: string) => {
    // 1. Get User ID
    let uid = currentUserId;
    if (!uid) {
      const { data } = await supabase.auth.getUser();
      uid = data.user?.id;
    }
    if (!uid) return;

    // 2. Count TOTAL paragraphs in book
    const { count: total } = await supabase
      .from("paragraphs")
      .select("*", { count: "exact", head: true })
      .eq("book_id", bookId);

    // 3. Count COMPLETED paragraphs for USER in THIS BOOK
    const { count: completed } = await supabase
      .from("user_progress")
      .select("*", { count: "exact", head: true })
      .eq("book_id", bookId)
      .eq("user_id", uid)
      .eq("is_completed", true);

    // 4. Update UI
    if (total && total > 0) {
      setBookProgress(Math.round(((completed || 0) / total) * 100));
    }

    // --- CALCULATE BOOK XP (Local) ---
    // 10 XP per completed paragraph
    const localXp = (completed || 0) * 10;
    setBookLevelXp(localXp);
  };

  useEffect(() => {
    if (!paragraphs || paragraphs.length === 0) {
      setChapterProgress(0);
      return;
    }

    // Count how many paragraphs in THIS specific chapter are done
    const completedCount = paragraphs.filter((p) => p.is_completed).length;
    const totalCount = paragraphs.length;

    // Calculate %
    const percent = Math.round((completedCount / totalCount) * 100);
    setChapterProgress(percent);
  }, [paragraphs]);

  useEffect(() => {
    const chapterIdFromUrl = searchParams.get("chapterId");
    console.log("URL PARAM:", chapterIdFromUrl); // <--- CHECK THIS LOG

    if (chapters.length > 0 && chapterIdFromUrl && !selectedChapter) {
      const match = chapters.find((c) => c.id === chapterIdFromUrl);
      if (match) setSelectedChapter(match);
    }
  }, [chapters, searchParams, selectedChapter]);

  const fetchBookData = async () => {
    if (!bookId) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

    // Fetch Book
    const bookRes = await fetch(`${API_URL}/books/${bookId}`);
    if (bookRes.ok) {
      const bookData = await bookRes.json();
      setBook(bookData);
      setBookStatus(bookData.status || "pending");
    }

    // Fetch Chapters
    const chaptersRes = await fetch(`${API_URL}/chapters/${bookId}`);
    if (chaptersRes.ok) {
      const chapterData = await chaptersRes.json();
      setChapters(chapterData);
    }

    setIsLoadingData(false);
  };

  useEffect(() => {
    fetchBookData();
  }, [bookId]);

  // Polling for status
  useEffect(() => {
    const interval = setInterval(() => {
      if (bookStatus?.startsWith("processing")) fetchBookData();
    }, 3000);
    return () => clearInterval(interval);
  }, [bookStatus, bookId]);

  // Load Paragraphs
  // Load Paragraphs & Merge with User Progress
  // Load Paragraphs & Merge with User Progress & RESTORE CURSOR
  useEffect(() => {
    const loadParagraphs = async () => {
      if (!selectedChapter) return;

      // 1. Fetch raw content
      const { data: rawParagraphs, error: paraError } = await supabase
        .from("paragraphs")
        .select("*")
        .eq("chapter_id", selectedChapter.id)
        .order("order_index", { ascending: true });

      if (paraError) return;

      const filteredRaw = rawParagraphs || [];


      // 2. Fetch User Progress
      let completedIds = new Set();
      if (user) {
        const { data: progressData } = await supabase
          .from("user_progress")
          .select("current_block_id")
          .eq("user_id", user.id)
          .eq("is_completed", true)
          .in(
            "current_block_id",
            filteredRaw.map((p) => p.id),
          );

        if (progressData) {
          progressData.forEach((p) => completedIds.add(p.current_block_id));
        }
      }

      // 3. Merge
      const mergedParagraphs = filteredRaw.map((p) => ({
        ...p,
        is_completed: completedIds.has(p.id),
      }));

      setParagraphs(mergedParagraphs || []);
      setIsGenerating(false);

      // --- 4. NEW: RESTORE ACTIVE STATE (The Fix) ---
      // Find the first paragraph that is NOT completed
      const resumeParagraph = mergedParagraphs.find((p) => !p.is_completed);

      if (resumeParagraph) {
        setActiveParagraphId(resumeParagraph.id);

        // Optional: Scroll to it automatically after a tiny delay
        setTimeout(() => {
          const el = document.getElementById(`para-${resumeParagraph.id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 500);
      } else {
        // If all are done, set to null (Chapter Complete)
        setActiveParagraphId(null);
      }
      // ---------------------------------------------
    };

    loadParagraphs();
  }, [selectedChapter, user]); // <--- Added 'user' to dependency so it re-runs on login

  useEffect(() => {
    // 1. Get the session immediately
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        // 2. ONLY fetch stats once we have the user
        fetchStatsForUser(data.user.id);
        fetchStats(data.user.id);
      }
    });
  }, []);

  // Load Chat History
  // Find your chat loading useEffect
  // RELIABLE CHAT LOADING
  useEffect(() => {
    const loadChatHistory = async () => {
      // 1. Strict Guard: Don't fetch if no chapter or no user
      if (!selectedChapter?.id) return;

      console.log(`💬 Fetching chats for Chapter: ${selectedChapter.id}`);

      const { data, error } = await supabase
        .from("chat_logs")
        .select("*")
        .eq("chapter_id", selectedChapter.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("❌ Chat Fetch Error:", error);
      } else if (data) {
        console.log(`✅ Loaded ${data.length} messages`);
        setMessages(
          data.map((m) => ({
            id: m.id,
            role: m.role as any,
            content: m.content,
            imageUrl: m.imageUrl, // Ensure your DB has this column if you use images in chat
          })),
        );
      }
    };

    loadChatHistory();
  }, [selectedChapter?.id]); // <--- Key Change: Depend on the ID string, not the object // <--- Dependency is correct

  // Reset audio if language changes
  useEffect(() => {
    setCurrentAudioMessageId(null);
    setPlayingMessageId(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // Reset time
    }
  }, [audioLanguage]);

  // Helper: Decides if a paragraph is "Real Content" or just "Noise"
  // Helper: Decides if a paragraph is "Real Content" or just "Noise"
  const isContentWorthExplaining = (text: string, type?: string) => {
    // Always explain images/code
    if (type === "image" || type === "code") return true;

    const cleanText = text.trim();

    // 1. Catches "Activity ______ 5.2" (Any amount of underscores)
    if (/^Activity\s*[_\.]+\s*\d+/i.test(cleanText)) return false;

    // 2. Catches "Fig. 6.3" or "Figure 6.3"
    if (/^Fig|^Figure|^Table|^Source/i.test(cleanText)) return false;

    // 3. Catches "(a) (b)" or simple labels
    if (/^(\([a-z]\)\s*)+$/i.test(cleanText)) return false;

    // 4. Catches pure numbers or very short labels
    if (cleanText.length < 20) return false;

    return true;
  };

  // Handle Resizing Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Calculate new width (Window Width - Mouse X Position)
      const newWidth = window.innerWidth - e.clientX;

      // Constraints: Min 300px, Max 800px
      if (newWidth > 300 && newWidth < 800) {
        setChatWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default"; // Reset cursor
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize"; // Force cursor while dragging
      document.body.style.userSelect = "none"; // Prevent text selection while dragging
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };
  }, [isResizing]);

  useEffect(() => {
    const chapterIdFromUrl = searchParams.get("chapterId");

    // Only run if we have chapters loaded and a URL param exists, but no chapter selected yet
    if (chapters.length > 0 && chapterIdFromUrl && !selectedChapter) {
      console.log("🔗 Restoring Chapter from URL:", chapterIdFromUrl);
      const match = chapters.find((c) => c.id === chapterIdFromUrl);
      if (match) {
        setSelectedChapter(match);
      }
    }
  }, [chapters, searchParams, selectedChapter]);

  const fetchStatsForUser = async (userId: string) => {
    // 1. Get XP
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp")
      .eq("id", userId)
      .single();

    if (profile) {
      console.log("✅ XP Loaded:", profile.xp);
      setUserXp(profile.xp || 0);
    } else {
      console.log("⚠️ No Profile found for XP");
    }

    // 2. Get Progress
    const { count: total } = await supabase
      .from("paragraphs")
      .select("*", { count: "exact", head: true })
      .eq("book_id", bookId);

    const { count: completed } = await supabase
      .from("user_progress")
      .select("*", { count: "exact", head: true })
      .eq("book_id", bookId)
      .eq("user_id", userId)
      .eq("is_completed", true);

    if (total && total > 0) {
      setBookProgress(Math.round(((completed || 0) / total) * 100));
    }
  };

  useEffect(() => {
    const chapterIdFromUrl = searchParams.get("chapterId");

    // Only run if we have chapters loaded and a URL param exists
    if (chapters.length > 0 && chapterIdFromUrl) {
      const match = chapters.find((c) => c.id === chapterIdFromUrl);
      if (match) {
        setSelectedChapter(match);
      }
    }
  }, [chapters, searchParams]);

  // --- HANDLERS ---

  const handleGenerateClick = () => {
    setScheduleMode('create');
    setIsScheduleModalOpen(true);
  };

  // 2. Triggered by "Skip" in Modal
  const handleSkipSchedule = () => {
    setIsScheduleModalOpen(false);
    handleGenerateMap(); // <--- Calls your existing ingestion function
  };

  const handleScheduleSave = async (time: string, channels: string[], timezone: string) => {
    setIsScheduleModalOpen(false);

    const [hour, minute] = time.split(':').map(Number);

    try {
      await fetch(`${API_URL}/schedule/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          bookId: bookId,
          chatId: "TEMP_CHAT_ID", // Backend looks up the real ID from profile
          hour,
          minute,
          timezone: timezone,
          channels: channels
        })
      });
      console.log("Schedule created");
    } catch (e) {
      console.error("Failed to save schedule:", e);
    }

    // Only start ingestion if we are in 'create' mode (not editing later)
    if (scheduleMode === 'create') {
      handleGenerateMap();
    }
  };

  // 1. INGESTION HANDLER (This generates the Course Map)


  const handleGenerateMap = async () => {
    if (!book?.file_url) return alert("Error: Book URL missing");
    setIsGenerating(true);
    setBookStatus("processing");

    try {
      const response = await fetch(`${API_URL}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: bookId,
          fileUrl: book.file_url,
          interest: book.analogy_topic || "General Learning", // Use real interest
          bookType: "Textbook",
        }),
      });
      if (!response.ok) throw new Error("Backend failed");
    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      setBookStatus("failed");
      alert("Failed to connect to AI Backend: " + e.message);
    }
  };

  // 2. EXPLAIN HANDLER
  const handleExplainDiagram = async (para: Paragraph) => {
    setAnalyzingParaId(para.id);

    try {
      // Get current user for saving to DB
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const res = await fetch(`${API_URL}/analyze-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paragraphId: para.id,
          imageUrl: para.content,
          // FIX: Use dynamic interest
          analogyTopic: book?.analogy_topic || "General Learning",
          context: selectedChapter?.title || "General Context",
        }),
      });
      const data = await res.json();

      setParagraphs((prev) =>
        prev.map((p) =>
          p.id === para.id ? { ...p, explanation: data.explanation } : p,
        ),
      );

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data.explanation,
          imageUrl: para.content,
        },
      ]);

      // Set active paragraph so Next Paragraph button appears
      setActiveParagraphId(para.id);

      // Save diagram explanation to database so it persists after refresh
      if (currentUser?.id && selectedChapter && data.explanation) {
        console.log("💾 Saving Diagram Explanation to DB...");
        await fetch(`${API_URL}/chat-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser.id,
            chapter_id: selectedChapter.id,
            role: 'assistant',
            content: data.explanation,
          })
        });
        console.log("✅ Diagram Explanation Saved!");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to analyze image");
    } finally {
      setAnalyzingParaId(null);
    }
  };

  // 3. GENERATE CHAPTER HANDLER
  const handleGenerateChapterContent = async () => {
    if (!selectedChapter) return;
    setIsGenerating(true);
    setChapterGenProgress(0); // Reset
    setParagraphs([]); // <--- Clear old data to prevent early exit

    try {
      await fetch(`${API_URL}/generate_chapter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterId: selectedChapter.id }),
      });

      // Poll for Status & Progress
      const interval = setInterval(async () => {
        // 1. Check Chapter Status (Progress)
        const { data: chapData } = await supabase
          .from("chapters")
          .select("status")
          .eq("id", selectedChapter.id)
          .single();

        console.log("📊 Frontend Polling Status:", chapData?.status); // DEBUG LOG

        if (chapData?.status && chapData.status.startsWith("processing_")) {
          const percent = parseInt(chapData.status.split("_")[1]);
          console.log("   --> Parsed Percent:", percent); // DEBUG LOG
          if (!isNaN(percent)) setChapterGenProgress(percent);
        }

        // 2. Check if Paragraphs are done (Standard Check)
        const { data } = await supabase
          .from("paragraphs")
          .select("*")
          .eq("chapter_id", selectedChapter.id)
          .order("order_index", { ascending: true });

        // Only stop if explicitly completed OR we have data and status is NOT processing
        const isStillProcessing = chapData?.status?.startsWith("processing");

        if (chapData?.status === "completed" || (data && data.length > 5 && !isStillProcessing)) {
          setParagraphs(data || []);
          setIsGenerating(false);
          setChapterGenProgress(0);
          clearInterval(interval);
        }
      }, 1000); // Poll every 1s for smoother bar
    } catch (e: any) {
      alert("Error: " + e.message);
      setIsGenerating(false);
    }
  };

  // 4. DELETE SCHEDULE HANDLER
  const handleDeleteSchedule = async () => {
    if (!user || !book) return;

    if (!confirm("Are you sure you want to turn off alerts for this book?")) return;

    try {
      const response = await fetch(`${API_URL}/schedule/delete/${user.id}/${book.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete schedule");
      }

      alert("Alerts turned off successfully.");
      setIsScheduleModalOpen(false);

    } catch (error) {
      console.error("Error deleting schedule:", error);
      alert("Failed to turn off alerts. Please try again.");
    }
  };

  // 5. CHAT HANDLER
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedChapter) return;

    const userText = input.trim();
    const tempId = Date.now().toString();

    // 1. UPDATE UI IMMEDIATELY
    const userMessage: Message = {
      id: tempId,
      role: "user",
      content: userText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput(""); // Clear input

    // Shortcut Logic
    const cleanCommand = userText.toLowerCase().replace(/[^a-z]/g, "");
    if (
      activeParagraphId &&
      ["yes", "next", "ok", "continue"].includes(cleanCommand)
    ) {
      setTimeout(() => handleNextParagraph(), 500);
      return;
    }

    setIsAiThinking(true);

    try {
      // 2. FORCE GET USER
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser?.id) throw new Error("User not logged in");

      // 3. SAVE USER MESSAGE TO DB (AWAIT THIS!)
      console.log("💾 Saving User Message...");
      const userMsgRes = await fetch(`${API_URL}/chat-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.id,
          chapter_id: selectedChapter.id,
          role: 'user',
          content: userText,
        })
      });

      if (!userMsgRes.ok) {
        const err = await userMsgRes.json().catch(() => ({}));
        console.error("❌ User Save Failed:", err);
        throw new Error(err.detail || 'Failed to save user message');
      } else {
        console.log("✅ User Message Saved");
      }

      // 4. CALL AI
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chapterId: selectedChapter.id,
          currentParagraphId: activeParagraphId,
          userResponse: userText,
          userId: currentUser.id,
          bookId: bookId,
        }),
      });

      if (!response.body) throw new Error("No AI Response");

      // 5. STREAM AI RESPONSE
      const aiMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: aiMessageId, role: "assistant", content: "" },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulatedText = "";

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunkValue = decoder.decode(value, { stream: true });
        accumulatedText += chunkValue;

        if (accumulatedText.toLowerCase().includes("[next]")) {
          const cleanText = accumulatedText.replace(/\[next\]/gi, "").trim();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId ? { ...msg, content: cleanText } : msg,
            ),
          );
          handleNextParagraph();
          return;
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId ? { ...msg, content: accumulatedText } : msg,
          ),
        );
      }

      // 6. SAVE AI RESPONSE TO DB (AWAIT THIS!)
      if (accumulatedText.trim()) {
        console.log("💾 Saving AI Message...");
        const aiMsgRes = await fetch(`${API_URL}/chat-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser.id,
            chapter_id: selectedChapter.id,
            role: 'assistant',
            content: accumulatedText,
          })
        });

        if (!aiMsgRes.ok) console.error("❌ AI Save Failed:", await aiMsgRes.json().catch(() => ({})));
        else console.log("✅ AI Message Saved");
      }
    } catch (error: any) {
      console.error("Chat Error:", error);
      // Optional: Add visual error state
    } finally {
      setIsAiThinking(false);
    }
  };

  // Find this function in BookClient.tsx and REPLACE it entirely
  const handleNextParagraph = async () => {
    if (!activeParagraphId || !user?.id) return;

    // 1. Current Paragraph Cleanup
    // (Mark current as done in UI)
    setParagraphs((prev) =>
      prev.map((p) =>
        p.id === activeParagraphId ? { ...p, is_completed: true } : p,
      ),
    );

    // 2. Find the NEXT SUBSTANTIVE Paragraph
    const currentIndex = paragraphs.findIndex(
      (p) => p.id === activeParagraphId,
    );
    let nextIndex = currentIndex + 1;
    let nextPara = paragraphs[nextIndex];

    // --- SMART SKIP LOOP ---
    // While there is a next paragraph AND it is "Noise"
    while (
      nextPara &&
      !isContentWorthExplaining(nextPara.content, nextPara.type)
    ) {
      console.log(`Skipping noise: ${nextPara.content.substring(0, 20)}...`);

      // Mark noise as completed in DB immediately (Background fire-and-forget)
      fetch(`${API_URL}/user-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          book_id: bookId,
          current_block_id: nextPara.id,
        })
      }).catch(err => console.error('Failed to save noise progress:', err));

      // Update Local State for the skipped item
      setParagraphs((prev) =>
        prev.map((p) =>
          p.id === nextPara.id ? { ...p, is_completed: true } : p,
        ),
      );

      // Move to next
      nextIndex++;
      nextPara = paragraphs[nextIndex];
    }
    // -----------------------

    // 3. Handle the Destination (The Real Paragraph)
    if (nextPara) {
      saveProgressToDb(activeParagraphId);
      setActiveParagraphId(nextPara.id);

      // Scroll to it
      setTimeout(() => {
        const el = document.getElementById(`para-${nextPara.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);

      // Trigger AI ONLY for this real paragraph
      triggerExplanation(nextPara.id);

      // Save Progress for the Real Paragraph
      await saveProgressToDb(nextPara.id); // See helper function below
    } else {
      // End of Chapter
      setActiveParagraphId(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "🎉 Chapter completed!",
        },
      ]);
    }
  };

  const handleSkipParagraph = async () => {
    if (!activeParagraphId || !user?.id) return;

    // Find current and next paragraphs
    const currentIndex = paragraphs.findIndex((p) => p.id === activeParagraphId);
    const nextPara = paragraphs[currentIndex + 1]; // n+1 (to skip)
    const targetPara = paragraphs[currentIndex + 2]; // n+2 (to go to)

    // Mark current as completed
    setParagraphs((prev) =>
      prev.map((p) =>
        p.id === activeParagraphId ? { ...p, is_completed: true } : p
      )
    );
    await saveProgressToDb(activeParagraphId);

    // Mark next paragraph (n+1) as skipped/completed
    if (nextPara) {
      setParagraphs((prev) =>
        prev.map((p) =>
          p.id === nextPara.id ? { ...p, is_completed: true } : p
        )
      );
      await saveProgressToDb(nextPara.id);
    }

    // Go to n+2
    if (targetPara) {
      setActiveParagraphId(targetPara.id);
      setTimeout(() => {
        const el = document.getElementById(`para-${targetPara.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      triggerExplanation(targetPara.id);
    } else {
      setActiveParagraphId(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "🎉 Chapter completed!"
        }
      ]);
    }
  };

  const handlePreviousParagraph = () => {
    if (!activeParagraphId) return;

    const currentIndex = paragraphs.findIndex((p) => p.id === activeParagraphId);
    if (currentIndex > 0) {
      const prevPara = paragraphs[currentIndex - 1];
      setActiveParagraphId(prevPara.id);

      setTimeout(() => {
        const el = document.getElementById(`para-${prevPara.id}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);

      triggerExplanation(prevPara.id);
    }
  };

  // Helper to keep code clean
  // Replace your existing saveProgressToDb with this robust version
  const saveProgressToDb = async (blockId: string) => {
    console.log("🔍 Attempting to save progress...");

    // 1. Force Fetch User (Do not rely on state)
    const {
      data: { user: currentUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      alert("❌ SAVE FAILED: You are not logged in!");
      console.error("Auth Error:", authError);
      return;
    }

    console.log("👤 User found:", currentUser.id);

    // 2. Try to Save progress via backend API
    const progressRes = await fetch(`${API_URL}/user-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        book_id: bookId,
        current_block_id: blockId,
      })
    });

    if (!progressRes.ok) {
      const err = await progressRes.json().catch(() => ({}));
      alert(`❌ DB ERROR: ${err.detail || 'Failed to save progress'}`);
      console.error("Progress Save Error:", err);
    } else {
      const data = await progressRes.json();
      console.log("✅ SAVE SUCCESSFUL:", data);
    }

    // 3. Save XP via profile API
    const newXp = (userXp || 0) + 10;
    const xpRes = await fetch(`${API_URL}/profile/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xp: newXp })
    });
    if (!xpRes.ok) console.error("XP Error:", await xpRes.json().catch(() => ({})));

    fetchStats();
  };

  const triggerExplanation = async (paraId: string) => {
    setIsAiThinking(true);

    try {
      // 1. GET USER
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser?.id) {
        console.error("Cannot explain: User not logged in");
        return;
      }

      // 2. GET PARAGRAPH CONTENT
      const targetPara = paragraphs.find((p) => p.id === paraId);
      if (!targetPara) {
        console.error("Paragraph not found");
        return;
      }

      // 3. CALL AGENTIC PIPELINE (Parser → Personalizer → Strategist → Evaluator)
      console.log("🧠 Calling Agentic Pipeline...");
      const response = await fetch(`${API_URL}/explain-agentic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: targetPara.content,
          user_interest: book?.analogy_topic || "General Learning",
          context: selectedChapter?.title || "General Context",
          paragraph_id: paraId,
        }),
      });

      if (!response.ok) {
        throw new Error("Agentic API failed");
      }

      const data = await response.json();
      console.log("✅ Agentic Response:", data);

      // 4. UPDATE UI
      const aiMessageId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: aiMessageId, role: "assistant", content: data.explanation },
      ]);

      // 5. SAVE TO DATABASE via backend API
      if (data.explanation) {
        console.log("💾 Saving Agentic Explanation to DB...");
        const saveRes = await fetch(`${API_URL}/chat-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: currentUser.id,
            chapter_id: selectedChapter!.id,
            role: 'assistant',
            content: data.explanation,
          })
        });

        if (!saveRes.ok) console.error("❌ Save Failed:", await saveRes.json().catch(() => ({})));
        else console.log("✅ Agentic Explanation Saved!");
      }
    } catch (e) {
      console.error("Agentic explain error:", e);
      alert("Failed to generate explanation. Please try again.");
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleMarkCompleted = async (paraId: string) => {
    // Optimistic update
    setParagraphs((prev) =>
      prev.map((p) => {
        if (p.id === paraId && !p.is_completed) {
          // Only increment if not already completed
          return { ...p, is_completed: true };
        }
        return p;
      })
    );

    // Sync with DB via backend API
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await fetch(`${API_URL}/user-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            book_id: bookId,
            current_block_id: paraId,
          })
        });
        // Re-fetch progress to double check
        fetchStats(user.id);
      }
    } catch (err) {
      console.error("Error marking completed:", err);
    }
  };

  // --- MISCONCEPTION FEEDBACK HANDLER ---
  const handleFeedback = async (messageId: string, messageContent: string, feedbackType: 'got_it' | 'confused') => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser?.id) return;

    const concept = paragraphs.find(p => p.id === activeParagraphId)?.section_title || "General Concept";

    setFeedbackGiven(prev => ({ ...prev, [messageId]: feedbackType }));

    try {
      if (feedbackType === 'confused') {
        await fetch(`${API_URL}/misconception/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: currentUser.id,
            paragraph_id: activeParagraphId || "",
            concept: concept,
            failed_analogy: messageContent,
            user_interest: book?.analogy_topic || "General",
          }),
        });

        // Add to review queue
        await fetch(`${API_URL}/reviews/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: currentUser.id,
            concept: concept,
            paragraph_id: activeParagraphId || "",
            book_id: bookId,
            chapter_id: null,
            failed_explanation: messageContent
          })
        });

        console.log("📊 Logged misconception + added to review queue");
      } else {
        await fetch(`${API_URL}/misconception/success`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concept: concept,
            user_interest: book?.analogy_topic || "General",
            analogy_text: messageContent,
          }),
        });
        console.log("✅ Logged successful analogy");

        // --- NEW: MARK PARAGRAPH AS COMPLETED ---
        if (activeParagraphId) {
          handleMarkCompleted(activeParagraphId);
        }
      }
    } catch (e) {
      console.error("Feedback logging error:", e);
    }
  };

  const groupParagraphsBySection = (list: Paragraph[]) => {
    const sections: { title: string; paragraphs: Paragraph[] }[] = [];
    list.forEach((p) => {
      const lastSection = sections[sections.length - 1];
      const currentTitle = p.section_title || "General";
      if (lastSection && lastSection.title === currentTitle) {
        lastSection.paragraphs.push(p);
      } else {
        sections.push({ title: currentTitle, paragraphs: [p] });
      }
    });
    return sections;
  };

  const startAiSession = (section: { paragraphs: Paragraph[] }) => {
    const nextPara = section.paragraphs.find((p) => !p.is_completed);
    if (nextPara) {
      setActiveParagraphId(nextPara.id);
      triggerExplanation(nextPara.id);
    } else {
      setActiveParagraphId(null);
    }
  };

  // --- RENDERERS ---

  // A. RENDER DASHBOARD (Missing in previous response)
  const renderDashboard = () => (
    <div className="h-full w-full overflow-y-auto p-10 relative">
      {bookStatus !== "pending" && (
        <button
          onClick={() => {
            setScheduleMode("edit");
            setIsScheduleModalOpen(true);
          }}
          className="absolute top-6 left-6 p-2 rounded-xl border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-all group z-50"
          title="Edit Study Schedule"
        >
          <Clock className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full"></span>
        </button>
      )}
      <div className="max-w-5xl mx-auto pb-20">
        {bookStatus === "completed" && (
          <div className="absolute top-0 right-0 hidden md:flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-700">
            <div className="bg-[#1e0a3c] border border-white/10 p-4 rounded-2xl shadow-xl flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">
                  Total Progress
                </p>
                <p className="text-2xl font-bold text-white">{bookProgress}%</p>
              </div>

              {/* Circular Progress Indicator */}
              <div className="relative w-12 h-12">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-gray-800"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  {/* Progress Circle */}
                  <path
                    className="text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    strokeDasharray={`${bookProgress}, 100`}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">
            {book?.title || "Loading..."}
          </h1>
          <div className="flex justify-center mt-4">
            <span
              className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase ${bookStatus === "completed"
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : bookStatus?.startsWith("processing")
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                  : bookStatus === "failed"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-gray-800 text-gray-400 border-gray-700"
                }`}
            >
              {bookStatus}
            </span>
          </div>
        </div>

        {/* PROCESSING STATE */}
        {/* PROCESSING STATE */}
        {bookStatus?.startsWith("processing") && (
          <div className="text-center py-20 border-2 border-dashed border-blue-500/30 rounded-3xl bg-blue-500/5 animate-pulse">
            <div className="w-full max-w-md mx-auto px-6">
              <div className="flex justify-between text-xs uppercase font-bold text-blue-300 mb-2">
                <span>Analyzing Book Structure...</span>
                <span>{parseInt(bookStatus.split('_')[1]) || 0}%</span>
              </div>
              <div className="w-full h-3 bg-blue-500/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-cyan-300 transition-all duration-500 ease-out"
                  style={{ width: `${parseInt(bookStatus.split('_')[1]) || 0}%` }}
                ></div>
              </div>
              <p className="text-blue-200/60 mt-4 text-sm font-medium">
                AI is reading pages and identifying chapters...
              </p>
            </div>
          </div>
        )}

        {/* PENDING STATE - SHOW GENERATE BUTTON */}
        {bookStatus === "pending" && (
          <div className="text-center py-24 border-2 border-dashed border-white/10 rounded-3xl bg-white/5">
            <FileText className="w-10 h-10 text-gray-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Organize
            </h2>
            <button
              onClick={handleGenerateClick}
              disabled={isGenerating}
              className="px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 inline-flex items-center"
            >
              {isGenerating ? (
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
              ) : (
                "✨ Generate Course Map"
              )}
            </button>
          </div>
        )}

        {/* FAILED STATE */}
        {bookStatus === "failed" && (
          <div className="text-center py-12 bg-red-900/10 border border-red-500/20 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white">Scan Failed</h3>
            <button
              onClick={() => setBookStatus("pending")}
              className="mt-4 text-red-300 underline"
            >
              Try Again
            </button>
          </div>
        )}

        {/* COMPLETED STATE - SHOW CHAPTERS */}
        {(bookStatus === "completed" || chapters.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => {
                  setSelectedChapter(chapter);
                  // Update URL here too
                  window.history.pushState(
                    null,
                    "",
                    `?chapterId=${chapter.id}`,
                  );
                }}
                className="text-left bg-[#1e0a3c] ..."
              >
                <div className="flex justify-between mb-4">
                  <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/20 px-2 py-1 rounded">
                    CH {chapter.order_index}
                  </span>
                  {chapter.start_page_num > 0 && (
                    <span className="text-[10px] text-gray-500">
                      Pg {chapter.start_page_num}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white line-clamp-2">
                  {chapter.title}
                </h3>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // B. RENDER READER
  const renderReader = () => {
    const groupedSections = groupParagraphsBySection(paragraphs);

    return (
      <div className="max-w-3xl mx-auto w-full p-8 space-y-8 pb-20">
        {/* STATS BAR */}
        <div className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-xl mb-8 backdrop-blur-md sticky top-0 z-10 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500/20 p-2 rounded-lg">
              <Flame className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500 font-bold">
                Interest
              </p>
              <p className="text-sm font-bold text-white capitalize">
                {book?.analogy_topic || "General"}
              </p>
            </div>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <PieChart className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500 font-bold">
                Progress
              </p>
              <p className="text-sm font-bold text-white">
                {chapterProgress}% Done
              </p>
            </div>


            <button
              onClick={() => {
                if (confirm("⚠️ Regenerate this chapter content? This will overwrite existing text.")) {
                  handleGenerateChapterContent();
                }
              }}
              className="ml-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors flex items-center gap-2"
              title="Regenerate Content"
            >
              <AlertCircle className="w-3 h-3" />
              Regenerate
            </button>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex items-center gap-3">
            <div className="bg-purple-500/20 p-2 rounded-lg">
              <BookOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500 font-bold">
                Book Total
              </p>
              <p className="text-sm font-bold text-white">{bookProgress}%</p>
            </div>
            <div className="bg-yellow-500/20 p-2 rounded-lg">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase text-gray-500 font-bold">
                Total XP
              </p>
              <p className="text-sm font-bold text-white">{bookLevelXp} XP</p>
            </div>
          </div>
        </div>

        {groupedSections.length === 0 && (
          <div className="text-center py-20">
            {isGenerating ? (
              <div className="w-full max-w-md mx-auto">
                <div className="flex justify-between text-xs uppercase font-bold text-purple-300 mb-2">
                  <span>Generating Chapter Content...</span>
                  <span>{chapterGenProgress}%</span>
                </div>
                <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-300 ease-out"
                    style={{ width: `${chapterGenProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-4 animate-pulse">
                  Reading pages, finding diagrams, and formatting code...
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateChapterContent}
                className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 mx-auto disabled:opacity-50 transition-all hover:scale-105"
              >
                ✨ Generate Chapter Content
              </button>
            )}
          </div>
        )}

        {groupedSections.map((section, secIdx) => {
          const isSectionComplete = section.paragraphs.every(
            (p) => p.is_completed,
          );
          return (
            <div
              key={secIdx}
              className={`relative group rounded-2xl p-6 border-2 transition-all ${isSectionComplete ? "border-green-500/20 bg-green-500/5" : "border-transparent hover:border-white/10 hover:bg-[#1e0a3c]"}`}
            >
              <h3 className="text-xl font-bold text-white mb-6 pl-2 border-l-4 border-purple-500">
                {section.title}
              </h3>

              <div className="absolute -right-4 top-6 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startAiSession(section);
                  }}
                  className="bg-purple-600 text-white p-2 rounded-lg shadow-lg hover:scale-105 flex items-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />{" "}
                  <span className="text-xs font-bold">Study</span>
                </button>
              </div>

              <div className="space-y-6">
                {section.paragraphs.map((para) => {
                  if (para.type === "image") {
                    // Check if we should show LaTeX for this paragraph
                    const showLatex = showLatexForPara[para.id] ?? !!para.latex_content;

                    return (
                      <div
                        key={para.id}
                        id={`para-${para.id}`}
                        className={`
          flex flex-col items-center p-4 rounded-xl transition-all duration-500 mb-6
          ${para.is_completed
                            ? "border-2 border-orange-500 bg-orange-500/5"
                            : "border border-white/5 bg-black/20"
                          }
          ${activeParagraphId === para.id ? "ring-2 ring-purple-500 shadow-lg shadow-purple-900/20" : ""}
        `}
                      >
                        {/* LaTeX Equation Block (Math-specific styling) */}
                        {para.latex_content && showLatex ? (
                          <div className="w-full relative group bg-[#2d2d2d] rounded-xl border border-white/10 overflow-hidden shadow-xl">
                            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                              <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500/20" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                                <div className="w-3 h-3 rounded-full bg-green-500/20" />
                              </div>
                              <span className="text-xs font-mono font-medium text-gray-400">LaTeX</span>
                              <button
                                onClick={() => setShowLatexForPara({ ...showLatexForPara, [para.id]: false })}
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                View Image
                              </button>
                            </div>
                            <div className="p-6 overflow-x-auto">
                              {para.content.startsWith('<div') && (
                                <pre className="text-xs bg-black p-2 mb-2 overflow-auto">
                                  {para.content.substring(0, 200)}
                                </pre>
                              )}
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex, rehypeRaw]}
                              >
                                {para.latex_content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ) : (
                          <div className="relative w-full">
                            <img
                              src={para.content}
                              alt="Diagram"
                              className="max-h-[350px] rounded-lg object-contain w-full"
                            />
                            {para.latex_content && (
                              <button
                                onClick={() => setShowLatexForPara({ ...showLatexForPara, [para.id]: true })}
                                className="absolute top-2 right-2 px-3 py-1 bg-purple-600/90 hover:bg-purple-500 text-white text-xs rounded-full font-bold backdrop-blur-sm"
                              >
                                📐 View LaTeX
                              </button>
                            )}
                          </div>
                        )}

                        {para.explanation ? (
                          <div className="mt-4 w-full bg-blue-900/20 border-l-4 border-cyan-400 p-4 rounded-r-lg text-sm text-gray-200">
                            <strong className="text-cyan-400 block mb-1 text-xs">
                              {para.contains_math ? "🧮 MATH EXPLANATION" : "AI VISION ANALYSIS"}
                            </strong>
                            {para.explanation}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleExplainDiagram(para)}
                            disabled={analyzingParaId === para.id}
                            className="mt-3 px-4 py-2 bg-blue-600/20 border border-blue-500/50 rounded-full text-blue-300 text-xs font-bold flex gap-2"
                          >
                            {analyzingParaId === para.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              para.contains_math ? "📐 Explain Math" : "✨ Explain Diagram"
                            )}
                          </button>
                        )}
                      </div>
                    );
                  }
                  // Text/Math
                  return (
                    <div
                      key={para.id}
                      id={`para-${para.id}`}
                      className={`
    text-gray-300 leading-relaxed p-6 rounded-xl transition-all duration-500 mb-4
    ${para.is_completed
                          ? "border-2 border-orange-500 bg-orange-500/5 text-gray-400"
                          : "bg-white/5 border border-transparent"
                        }
    ${activeParagraphId === para.id
                          ? "bg-purple-900/30 border-l-4 border-l-purple-400 ring-1 ring-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)] transform scale-[1.01]"
                          : ""
                        }
  `}
                    >
                      {para.content.trim().startsWith('<div') || para.content.trim().startsWith('<table') ? (
                        <div
                          className="prose prose-invert max-w-none [&_table]:bg-[#1a1a2e] [&_th]:bg-[#1F4E79] [&_th]:text-white [&_td]:text-gray-200 [&_tr:nth-child(even)_td]:bg-[#252540] [&_tr:nth-child(odd)_td]:bg-[#1a1a2e] [&_td]:border-[#444]"
                          dangerouslySetInnerHTML={{ __html: para.content }}
                        />
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            p: ({ node, children }) => (
                              <p className="mb-4 text-gray-300 leading-relaxed">{children}</p>
                            ),
                            code(props: any) {
                              const { node, inline, className, children, ...rest } = props;
                              const match = /language-(\w+)/.exec(className || "");
                              const isBlock = !inline;

                              return isBlock ? (
                                <div className="relative group my-6 bg-[#1E1E2E] rounded-xl border border-white/10 overflow-hidden shadow-xl max-w-full">
                                  <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                                    <div className="flex gap-1.5">
                                      <div className="w-3 h-3 rounded-full bg-red-500/20" />
                                      <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                                      <div className="w-3 h-3 rounded-full bg-green-500/20" />
                                    </div>
                                    <span className="text-xs font-mono font-medium text-gray-400 capitalize">
                                      {match ? match[1] : 'text'}
                                    </span>
                                  </div>
                                  <div className="p-4 overflow-x-auto w-full">
                                    <code className={`${className} font-mono text-sm whitespace-pre-wrap break-words block text-gray-300`} {...rest}>
                                      {children}
                                    </code>
                                  </div>
                                </div>
                              ) : (
                                <code className="px-1.5 py-0.5 bg-purple-500/20 rounded text-purple-200 text-sm font-mono whitespace-pre-wrap break-words" {...rest}>
                                  {children}
                                </code>
                              );
                            },
                          }}
                        >
                          {para.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handlePlayAudio = async (text: string) => {
    setIsPlaying(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          language: selectedLanguage, // "hindi", "english", etc.
        }),
      });

      if (!res.ok) throw new Error("Audio generation failed");

      // Convert response to Blob and play
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
      }
      setAudioUrl(url);
    } catch (e) {
      console.error(e);
      alert("Could not play audio");
      setIsPlaying(false);
    }
  };

  const handleToggleAudio = async (messageId: string, text: string) => {
    // 1. If currently playing THIS message -> PAUSE
    if (playingMessageId === messageId) {
      audioRef.current?.pause();
      setPlayingMessageId(null);
      return;
    }

    //RESUME
    // If we are clicking a message that is already loaded (but paused)...
    if (currentAudioMessageId === messageId && audioRef.current) {
      audioRef.current.play();
      setPlayingMessageId(messageId); // UI shows "Pause" button
      return;
    }

    // 2. If playing ANOTHER message -> STOP IT
    if (playingMessageId) {
      audioRef.current?.pause();
      setPlayingMessageId(null);
    }

    setLoadingAudioId(messageId); // Start Spinner

    try {
      // 3. Call API
      const res = await fetch(`${API_URL}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text,
          language: audioLanguage // Use selected language
        }),
      });

      if (!res.ok) throw new Error("Audio generation failed");

      // 4. Play Audio
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setPlayingMessageId(messageId); // Set Active Icon to Pause
        setCurrentAudioMessageId(messageId);  // It is loaded
        // Reset when finished
        audioRef.current.onended = () => setPlayingMessageId(null);
      }

    } catch (e) {
      console.error(e);
      alert("Could not generate audio");
    } finally {
      setLoadingAudioId(null); // Stop Spinner
    }
  };

  // --- MAIN UI ---
  if (isLoadingData)
    return (
      <div className="bg-[#13002b] h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );

  return (
    <div className="flex h-screen bg-[#13002b] text-white overflow-hidden font-sans">
      {/* LEFT SIDEBAR */}
      <div
        className={`flex-shrink-0 bg-[#0a0212] border-r border-white/5 flex flex-col transition-all ${isSidebarOpen ? "w-72" : "w-0 overflow-hidden"}`}
      >
        <div className="p-4 border-b border-white/5 flex justify-between">
          <h2 className="font-semibold">Table of Contents</h2>
          <button onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => {
                setSelectedChapter(chapter);
                // Update URL without reloading page
                window.history.pushState(null, "", `?chapterId=${chapter.id}`);
              }}
              className={`w-full text-left p-3 rounded-xl text-sm mb-2 transition-all duration-300 relative overflow-hidden group
      ${selectedChapter?.id === chapter.id
                  ? // ACTIVE STATE: Cyan Ring + Glow + Subtle Background
                  "text-white bg-white/5 ring-1 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                  : // INACTIVE STATE
                  "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                }
    `}
            >
              <span className="mr-2 font-mono text-xs opacity-50">
                {chapter.order_index}.
              </span>{" "}
              {chapter.title}
            </button>
          ))}
        </div>
        <div className="p-4 space-y-2">
          {(() => {
            const completedParagraphsCount = paragraphs.filter(p => p.is_completed).length;
            return (
              <>
                <button
                  onClick={() => router.push(`/dashboard/book/${bookId}/test`)}
                  disabled={completedParagraphsCount < 5}
                  className={`w-full p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition ${completedParagraphsCount >= 5
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                    : "bg-gray-600/50 cursor-not-allowed opacity-60"
                    }`}
                  title={
                    completedParagraphsCount < 5
                      ? `Complete ${5 - completedParagraphsCount} more paragraph(s) to unlock tests (${completedParagraphsCount}/5)`
                      : "Take a test on this book"
                  }
                >
                  <Trophy className="w-4 h-4" /> Take Test
                  {completedParagraphsCount < 5 && (
                    <span className="text-xs opacity-70">({completedParagraphsCount}/5)</span>
                  )}
                </button>
                <button
                  onClick={() => router.push("/dashboard/tests/history")}
                  className="w-full p-3 bg-blue-600/20 border border-blue-500/50 hover:bg-blue-600/30 rounded-xl flex items-center justify-center gap-2 text-sm text-blue-300 font-bold transition"
                >
                  <Trophy className="w-4 h-4" /> View Test History
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 text-sm"
                >
                  <LogOut className="w-4 h-4" /> Back to Dashboard
                </button>
              </>
            );
          })()}
        </div>
      </div>

      {/* CENTER AREA (DASHBOARD OR READER) */}
      <div className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-purple-600/30">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-20 bg-[#1e0a3c] p-2 rounded-lg border border-white/10 shadow-lg"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        {/* LOGIC TOGGLE */}
        {selectedChapter ? renderReader() : renderDashboard()}
      </div>
      <div
        onMouseDown={() => setIsResizing(true)}
        className={`w-1 hover:w-2 bg-white/5 hover:bg-purple-500/50 cursor-col-resize transition-all z-50 flex items-center justify-center group ${isResizing ? "bg-purple-500" : ""}`}
      >
        {/* Visual Dots for Grip */}
        <div className="h-8 w-[2px] bg-gray-600 group-hover:bg-white rounded-full" />
      </div>

      {/* RIGHT SIDEBAR (CHAT) */}
      {/* <div className="w-[400px] bg-[#0f0518] border-l border-white/5 flex flex-col"> */}
      <div
        style={{ width: `${chatWidth}px` }} // Dynamic Width
        className="flex-shrink-0 bg-[#0f0518] border-l border-white/5 flex flex-col transition-[width] duration-0 ease-linear"
      >
        <div className="p-4 border-b border-white/5 bg-[#1e0a3c]/50">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-400" /> AI Tutor
          </h2>
          <div className="flex items-center gap-2 bg-black/20 rounded-lg px-2 py-1 border border-white/10">
            <Globe className="w-3 h-3 text-gray-400" />
            <select
              value={audioLanguage}
              onChange={(e) => setAudioLanguage(e.target.value)}
              className="bg-transparent text-xs text-gray-300 outline-none cursor-pointer uppercase font-bold"
            >
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="spanish">Spanish</option>
              <option value="chinese">Chinese</option>
            </select>
          </div>

        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.role === "user"
                  ? "bg-purple-600 text-white rounded-br-none"
                  : "bg-[#1e0a3c] border border-white/10 text-gray-200 rounded-bl-none"
                  }`}
              >
                {/* 1. Image (if any) */}
                {m.imageUrl && (
                  <img
                    src={m.imageUrl}
                    className="mb-2 rounded-lg border border-white/10"
                    alt="Diagram context"
                  />
                )}

                {/* 2. Text Content */}
                <ReactMarkdown>{m.content}</ReactMarkdown>

                {/* 3. NEW AUDIO CONTROLS (Replace old button with this) */}
                {m.role === 'assistant' && (
                  <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2">
                    <button
                      onClick={() => handleToggleAudio(m.id, m.content)}
                      disabled={loadingAudioId === m.id}
                      className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all
                          ${playingMessageId === m.id
                          ? 'bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}
                        `}
                    >
                      {/* Dynamic Icon Logic */}
                      {loadingAudioId === m.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : playingMessageId === m.id ? (
                        <Pause className="w-3 h-3 fill-current" />
                      ) : (
                        <Play className="w-3 h-3 fill-current" />
                      )}

                      <span>
                        {loadingAudioId === m.id ? "Loading..." : playingMessageId === m.id ? "Pause" : "Listen"}
                      </span>
                    </button>

                    {/* Playing Status Indicator */}
                    {playingMessageId === m.id && (
                      <span className="text-[10px] text-purple-300 capitalize animate-in fade-in">
                        Playing in {audioLanguage}
                      </span>
                    )}
                  </div>
                )}

                {/* 4. FEEDBACK BUTTONS (Misconception Tracking) */}
                {m.role === 'assistant' && m.content && (
                  <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
                    {feedbackGiven[m.id] ? (
                      <span className={`text-xs ${feedbackGiven[m.id] === 'got_it' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {feedbackGiven[m.id] === 'got_it' ? '✓ Thanks for the feedback!' : '🔄 We\'ll improve this'}
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleFeedback(m.id, m.content, 'got_it')}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors"
                        >
                          ✓ Got it!
                        </button>
                        <button
                          onClick={() => handleFeedback(m.id, m.content, 'confused')}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50 transition-colors"
                        >
                          🤔 I don't get it
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isAiThinking && (
            <div className="flex justify-start">
              <div className="bg-[#1e0a3c] p-3 rounded-2xl rounded-bl-none">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              </div>
            </div>
          )}
          {activeParagraphId && !isAiThinking && messages.length > 0 && (
            <div className="flex justify-end mt-4 mb-2 animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded-xl rounded-br-none text-right shadow-lg">
                <p className="text-[10px] text-purple-300 uppercase font-bold mb-2 tracking-wider">
                  Section Completed
                </p>
                <p className="text-xs text-gray-300 mb-3">
                  Type{" "}
                  <span className="text-white font-mono bg-white/10 px-1 rounded">
                    Next
                  </span>{" "}
                  or click below to continue.
                </p>
                <button
                  onClick={handleNextParagraph}
                  className="ml-auto mb-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all"
                >
                  Next Paragraph <ChevronRight className="w-3 h-3" />
                </button>
                <button className="ml-auto mb-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all" onClick={handlePreviousParagraph}>
                  ← Previous
                </button>
                <button className="ml-auto bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-all" onClick={handleSkipParagraph}>
                  Skip the next paragraph →
                </button>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="p-4 bg-[#0a0212] border-t border-white/5">
          <form onSubmit={handleSendMessage} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!selectedChapter || isAiThinking}
              placeholder="Ask a question..."
              className="w-full bg-[#1e0a3c] border border-white/10 rounded-xl py-3 px-4 pr-12 focus:border-purple-500 outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isAiThinking}
              className="absolute right-2 top-2.5 p-1.5 bg-purple-600 rounded-lg"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
      <audio ref={audioRef} className="hidden" />
      {user && (
        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          onSave={handleScheduleSave}
          onSkip={handleSkipSchedule}
          onDelete={handleDeleteSchedule}
          mode={scheduleMode}
          userId={user.id}
          botName="learnainew_bot" // Your actual bot name
        />
      )}
    </div>
  );
};
