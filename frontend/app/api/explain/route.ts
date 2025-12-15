// frontend/app/api/explain/route.ts
import { NextResponse } from "next/server";
const BACKEND = process.env.BACKEND_UPLOAD_URL!;

export async function POST(request: Request) {
  if (!BACKEND) return NextResponse.json({ error: "Missing BACKEND_UPLOAD_URL" }, { status: 500 });
  const payload = await request.json();
  const res = await fetch(`${BACKEND}/api/explain`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
