import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const body = await req.json();
  const { bookId, fileUrl, analogyTopic } = body;

  // 1. Send data to n8n Webhook
  // Replace this URL with your actual n8n Production Webhook URL
  const n8nWebhookUrl = "https://your-n8n-instance.com/webhook/process-book";
  
  try {
    // Fire and forget (don't wait for n8n to finish, it takes too long)
    fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, fileUrl, analogyTopic })
    });

    return NextResponse.json({ success: true, message: "Processing started" });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to trigger n8n" }, { status: 500 });
  }
}