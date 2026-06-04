import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OCRClient } from "./OCRClient";

export default async function OCRPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  return <OCRClient user={user} />;
}
