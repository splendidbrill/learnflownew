// frontend/app/api/create-subject/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const { name, color, description } = await req.json();
  const supabase = await createClient();

  const { data, error } = await supabase.from("subjects").insert([{ name, color, description }]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subject: data });
}
