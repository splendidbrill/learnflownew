// // import { createClient } from '@supabase/supabase-js';

// // const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// // const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// // export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// /**
//  * Returns a new supabase client instance.
//  */
// export function createClient() {
//   return createSupabaseClient(supabaseUrl, supabaseAnonKey);
// }


// frontend/lib/supabase/client.ts
// import { createClient } from "@supabase/supabase-js";

// const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// if (!url || !anon) {
//   throw new Error("Missing NEXT_PUBLIC_SUPABASE_* env vars");
// }

// export const supabase = createClient(url, anon);

// export function createSupabaseClient() {
//   return supabase;
// }

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
