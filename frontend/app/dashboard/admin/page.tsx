import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AdminPanel } from './AdminPanel';
import { Sidebar } from '../Sidebar';

// Server-side founder email check (secure)
const FOUNDER_EMAIL = process.env.NEXT_PUBLIC_FOUNDER_EMAIL || "";

export default async function AdminPage() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  // Auth check
  if (!user) {
    redirect('/auth');
  }
  
  // Founder check - only allow splendidbrill@gmail.com
  if (user.email !== FOUNDER_EMAIL) {
    redirect('/dashboard');
  }

  return (
    <div className="flex h-screen bg-[#13002b] overflow-hidden">
      <Sidebar user={user} />
      <div className="flex-1 ml-20 overflow-y-auto h-full">
        <AdminPanel user={user} />
      </div>
    </div>
  );
}
