import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClientWrapper } from "./ClientWrapper";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/");
  }

  return <ClientWrapper user={user} />;
}