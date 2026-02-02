import OpenAI from 'openai'; // Standard library
import { createClient } from '@supabase/supabase-js';

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

  // 2. Setup Supabase inside handler
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const createClient = (await import('@supabase/supabase-js')).createClient;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { messages, chapterId } = await req.json();

    // 3. RAG: Fetch Context from Supabase
    const { data: paragraphs } = await supabase
      .from('paragraphs')
      .select('content')
      .eq('chapter_id', chapterId)
      .order('order_index', { ascending: true });

    const contextText = paragraphs?.map(p => p.content).join('\n\n').slice(0, 15000) || "";

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