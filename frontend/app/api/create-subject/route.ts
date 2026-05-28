// frontend/app/api/create-subject/route.ts
import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export async function POST(req: Request) {
  const { name, color, description, user_id } = await req.json();

  try {
    const res = await fetch(`${API_URL}/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color, description, user_id })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail || 'Failed to create course' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ subject: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
