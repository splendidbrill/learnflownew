// import { createClient } from '../../../../lib/supabase/server';
import { createClient } from '../../../../lib/supabase/server';
import { redirect } from 'next/navigation';
import { BookClient } from './BookClient';

// This is a Server Component
export default async function BookPageRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  // 1. Check Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // 2. Fetch Book Data (Server Side)
  // We fetch this here so the page loads with data immediately (SEO/Speed)
  const { data: book, error } = await supabase
    .from('books')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !book) {
    console.error("Book not found:", error);
    redirect('/dashboard'); // Redirect back if book doesn't exist
  }

  // 3. Pass data to Client Component
  return <BookClient book={book} user={user} />;
}