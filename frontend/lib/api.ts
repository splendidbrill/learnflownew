const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export async function getAiExplanation(
  content: string,
  interests: string[],
  bookType: string
): Promise<any> {
  const response = await fetch(`${API_URL}/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: content,
      interests: interests,
      book_type: bookType,
    }),
  });

  if (!response.ok) throw new Error("AI Backend Error");
  return response.json();
}

export async function uploadBook(
  title: string,
  userId: string,
  file: File
): Promise<any> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("user_id", userId);
  formData.append("file", file);

  const response = await fetch(`${API_URL}/upload-book`, {
    method: "POST",
    body: formData, // No Content-Type header needed for FormData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload Failed: ${errorText}`);
  }
  
  return response.json();
}