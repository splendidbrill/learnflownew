// export async function uploadBookToBackend(params: {
//   file?: File;      // ✅ optional now
//   title: string;
//   author?: string | null;
//   subjectId: string;
//   userId: string;
// }) {
//   const formData = new FormData();
//   formData.append("title", params.title);
//   formData.append("user_id", params.userId);
//   formData.append("subject_id", params.subjectId);

//   if (params.author) formData.append("author", params.author);
//   if (params.file) formData.append("file", params.file);

//   const res = await fetch(`${process.env.BACKEND_UPLOAD_URL}/api/upload-book`, {
//     method: "POST",
//     body: formData,
//   });

//   if (!res.ok) throw new Error("Upload failed");

//   return res.json();
// }
// lib/api.ts
// Frontend API helpers for talking to your Python backend & Supabase-backed routes.
// Assumes environment variable NEXT_PUBLIC_BACKEND_UPLOAD_URL is set (e.g. http://127.0.0.1:8000)

export type UploadBookParams = {
  file?: File;
  title: string;
  author?: string | null;
  subjectId: string;
  userId: string;
};

export type ApiResponse<T = any> = {
  status: "success" | "error";
  message?: string;
  data?: T;
  book?: any;
};

/**
 * Uploads a book (optionally with PDF) to the Python backend.
 * Expects backend route: POST ${BACKEND_UPLOAD_URL}/api/upload-book
 * Backend should return: { status: "success", book: { ... } }
 */
export async function uploadBookToBackend(params: UploadBookParams): Promise<any> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_UPLOAD_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.BACKEND_UPLOAD_URL as string | undefined);

  if (!backendUrl) {
    throw new Error("Missing NEXT_PUBLIC_BACKEND_UPLOAD_URL / NEXT_PUBLIC_BACKEND_URL env variable");
  }

  const url = backendUrl.replace(/\/$/, "") + "/api/upload-book";
  const form = new FormData();

  form.append("title", params.title);
  form.append("user_id", params.userId);
  form.append("subject_id", params.subjectId);

  if (params.author) form.append("author", params.author);
  if (params.file) form.append("file", params.file);

  const res = await fetch(url, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${res.statusText} ${text}`);
  }

  const body = await res.json().catch(() => null);
  if (!body) throw new Error("Upload returned empty response");

  return body;
}

/**
 * Fetch subjects for current user from our Next.js/Supabase API or direct Supabase route.
 * This helper assumes you have an API route or you can use Supabase client directly in components.
 */
export async function fetchSubjects(): Promise<any[]> {
  const res = await fetch("/api/subjects"); // Prefer a Next.js route that uses server auth
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch subjects: ${res.status} ${text}`);
  }
  const body = await res.json();
  return body.subjects ?? body.data ?? [];
}

/**
 * Fetch a single book and its metadata (server-side route recommended)
 */
export async function fetchBookById(id: string): Promise<any> {
  const res = await fetch(`/api/book/${encodeURIComponent(id)}`);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch book: ${res.status} ${text}`);
  }
  const body = await res.json();
  return body.book ?? body.data ?? body;
}

/**
 * Send a chat follow-up to your backend AI endpoint.
 * Expects a backend route that accepts JSON { originalText, question, history } and returns { reply: string }
 */
export async function sendChat(originalText: string, question: string, history: { role: string; content: string }[] = []): Promise<string> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_UPLOAD_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.BACKEND_UPLOAD_URL as string | undefined);

  if (!backendUrl) throw new Error("Missing backend URL env");

  const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ originalText, question, history }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Chat failed: ${res.status} ${text}`);
  }

  const body = await res.json();
  // Backend should return { reply: "..." } or { result: { reply: "..." } }
  return body.reply ?? body.result?.reply ?? body;
}

/**
 * Request an AI explanation (summary + analogy) for a given text.
 * Wrapper around backend /api/explain
 */
export async function getAiExplanation(text: string, interests: string[] = [], bookType = "general"): Promise<any> {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_UPLOAD_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    (process.env.BACKEND_UPLOAD_URL as string | undefined);

  if (!backendUrl) throw new Error("Missing backend URL env");

  const res = await fetch(`${backendUrl.replace(/\/$/, "")}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, interests, book_type: bookType }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Explain failed: ${res.status} ${text}`);
  }

  const body = await res.json();
  return body;
}

/** Generic small helper to POST JSON to backend and return parsed JSON or throw. */
export async function postJson<T = any>(path: string, payload: any, baseUrl?: string): Promise<T> {
  const base = baseUrl || process.env.NEXT_PUBLIC_BACKEND_UPLOAD_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!base) throw new Error("Missing backend base URL");
  const res = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Request failed: ${res.status} ${text}`);
  }
  return res.json();
}

export default {
  uploadBookToBackend,
  fetchSubjects,
  fetchBookById,
  sendChat,
  getAiExplanation,
  postJson,
};
