import OpenAI from 'openai'; // Standard library

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// 1. Setup OpenAI client pointing to OpenRouter

export async function POST(req: Request) {
  // 1. Setup OpenAI client inside handler (prevents build-time error)
  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'AI Tutor App',
    },
  });

  try {
    const { messages, chapterId } = await req.json();

    // 2. RAG: Fetch Context from backend API
    const paragraphsRes = await fetch(`${BACKEND_URL}/paragraphs/${chapterId}`);
    const paragraphs = paragraphsRes.ok ? await paragraphsRes.json() : [];

    const contextText = (paragraphs as { content: string }[])?.map(p => p.content).join('\n\n').slice(0, 15000) || "";

    const systemPrompt = `
      You are an AI Tutor.
      Here is the chapter content:
      """
      ${contextText}
      """
      Answer based ONLY on this content. Keep it short.
    `;

    // 4. Create Stream using standard OpenAI library
    const response = await openai.chat.completions.create({
      model: 'meta-llama/llama-3.2-3b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      stream: true,
    });

    // 5. Convert OpenAI Stream to Web Stream for the frontend
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of response) {
          const content = chunk.choices[0]?.delta?.content || '';
          if (content) {
            controller.enqueue(new TextEncoder().encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}