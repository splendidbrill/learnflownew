
import { createClient } from '@/lib/supabase/client';
import { redirect } from "next/navigation";
import { ClientWrapper } from "@/components/dashboard/ClientWrapper";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get currently logged-in user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Ensure user profile exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/profile");
  }

  // Send user to the client dashboard component
  return <ClientWrapper user={user} />;
}
