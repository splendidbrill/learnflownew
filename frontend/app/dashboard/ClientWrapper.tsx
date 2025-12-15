// "use client";
// import React from 'react';
// import { useStore } from '../store';
// import { Dashboard } from './Dashboard';
// import { BookPage } from './BookPage';
// import { User } from '@supabase/supabase-js';

// interface ClientWrapperProps {
//   user: User;
// }

// export const ClientWrapper: React.FC<ClientWrapperProps> = ({ user }) => {
//   const { activeBook, setActiveBook } = useStore();

//   // Render Book Page if a book is active
//   if (activeBook) {
//     // 👇 UPDATED: Added user={user} here
//     return <BookPage book={activeBook} user={user} onBack={() => setActiveBook(null)} />;
//   }

//   // Render Dashboard
//   return <Dashboard user={user} />;
// };

// frontend/components/dashboard/ClientWrapper.tsx
// "use client";
// import React from "react";
// import {Dashboard} from "./Dashboard";
// import { User } from "@supabase/supabase-js";

// export default function ClientWrapper({ user }: { user: User }) {
//   return <Dashboard user={user} />;
// }

"use client";
import React from 'react';
import { useStore } from './store';
import { Dashboard } from './Dashboard';
import { BookPage } from './unused/BookPage';
import { User } from '@supabase/supabase-js';

interface ClientWrapperProps {
  user: User;
}

export const ClientWrapper: React.FC<ClientWrapperProps> = ({ user }) => {
  const { activeBook, setActiveBook } = useStore();

  if (activeBook) {
    return <BookPage book={activeBook} user={user} onBack={() => setActiveBook(null)} />;
  }

  return <Dashboard user={user} />;
};
