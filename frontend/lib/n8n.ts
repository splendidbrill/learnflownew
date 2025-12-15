// This handles the communication with your n8n workflows
const API_URL = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || "YOUR_N8N_WEBHOOK_URL";

export async function ingestBook(bookId: string, fileUrl: string, userId: string) {
  // Replace with your actual n8n webhook URL for ingestion
  console.log("Triggering n8n ingestion for:", bookId);
  // Example fetch:
  // await fetch('https://your-n8n-instance.com/webhook/ingest', { 
  //   method: 'POST', 
  //   body: JSON.stringify({ bookId, fileUrl, userId }) 
  // });
}

export async function askAiTutor(bookId: string, question: string, userId: string) {
  // Replace with your actual n8n webhook URL for chat
  console.log("Asking AI:", question);
  
  // Mock response for now so the UI doesn't break
  return new Promise<{ reply: string }>((resolve) => {
    setTimeout(() => {
      resolve({ reply: "I am a mock AI response. Connect your n8n webhook in lib/n8n.ts to get real answers!" });
    }, 1000);
  });
}