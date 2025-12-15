// frontend/app/api/upload-book-proxy/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const BACKEND = process.env.BACKEND_UPLOAD_URL!;
  if (!BACKEND) return NextResponse.json({ error: "Missing BACKEND_UPLOAD_URL" }, { status: 500 });
  const body = await request.formData();

  const res = await fetch(`${BACKEND}/api/upload-book`, { method: "POST", body });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
