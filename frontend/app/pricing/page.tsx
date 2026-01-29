import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PricingPage from './PricingPage';

export default async function Pricing() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  return <PricingPage user={user} />;
}
